if (require("os").platform() !== "win32") {
  throw new Error(
    "The module 'node-expose-sspi' can only work on Microsoft Windows platform."
  );
}

const sspi = require("./lib/sspi");
const createError = require("http-errors");
const { decode, encode } = require("base64-arraybuffer");
const { printHexDump, trace } = require("./misc/misc");

module.exports = sspi;

sspi.ssoAuth = () => {
  const { credential, tsExpiry } = sspi.AcquireCredentialsHandle("Negotiate");

  // serverContextHandle seems to be useful only for NTLM, not Kerberos.
  // because Kerberos will not request many times the client to complete the SSO Authentication.
  let serverContextHandle;

  return (req, res, next) => {
    try {
      const auth = req.get("authorization");
      if (!auth) {
        serverContextHandle = undefined;
        return res
          .status(401)
          .set("WWW-Authenticate", "Negotiate")
          .end();
      }

      if (!auth.startsWith("Negotiate ")) {
        return next(createError(400, `Malformed authentication token ${auth}`));
      }

      req.auth = req.auth || {};
      req.auth.token = auth.substring("Negotiate ".length);
      const protocol = req.auth.token.startsWith("YII") ? "Kerberos" : "NTLM";
      trace("SPNEGO token: " + protocol);
      const buffer = decode(req.auth.token);

      const input = {
        credential,
        clientSecurityContext: {
          SecBufferDesc: {
            ulVersion: 0,
            buffers: [buffer]
          }
        }
      };
      if (serverContextHandle) {
        input.serverContextHandle = serverContextHandle;
      }
      const serverSecurityContext = sspi.AcceptSecurityContext(input);
      serverContextHandle = serverSecurityContext.serverContextHandle;

      trace(printHexDump(serverSecurityContext.SecBufferDesc.buffers[0]));

      if (serverSecurityContext.SECURITY_STATUS === "SEC_I_CONTINUE_NEEDED") {
        return res
          .status(401)
          .set(
            "WWW-Authenticate",
            "Negotiate " +
              encode(serverSecurityContext.SecBufferDesc.buffers[0])
          )
          .end();
      }

      if (serverSecurityContext.SECURITY_STATUS === "SEC_E_OK") {
        res.set(
          "WWW-Authenticate",
          "Negotiate " + encode(serverSecurityContext.SecBufferDesc.buffers[0])
        );

        const sso = {};

        const names = sspi.QueryContextAttributes(
          serverContextHandle,
          "SECPKG_ATTR_NAMES"
        );
        const [domain, name] = names.sUserName.split("\\");
        sso.user = { domain, name };

        // impersonate to retrieve the userToken.
        sspi.ImpersonateSecurityContext(serverContextHandle);
        trace("impersonate security context ok");
        const userToken = sspi.OpenThreadToken();
        trace("userToken: ", userToken);
        sso.user.displayName = sspi.GetUserNameEx("NameDisplay");
        sspi.RevertSecurityContext(serverContextHandle);

        const groups = sspi.GetTokenInformation(userToken, "TokenGroups");
        trace("groups: ", groups);
        sso.user.groups = groups;

        // free the userToken
        sspi.CloseHandle(userToken);

        const { sid } = sspi.LookupAccountName(names.sUserName);
        sso.user.sid = sid;

        // owner info.
        const owner = sspi.GetUserName();
        trace("owner: ", owner);
        sso.owner = { name: owner };
        sso.owner.displayName = sspi.GetUserNameEx("NameDisplay");

        const processToken = sspi.OpenProcessToken();
        const ownerGroups = sspi.GetTokenInformation(
          processToken,
          "TokenGroups"
        );
        trace("ownerGroups: ", ownerGroups);
        sso.owner.groups = ownerGroups;
        sspi.CloseHandle(processToken);

        try {
          const { sid, domain } = sspi.LookupAccountName(owner);
          sso.owner.sid = sid;
          sso.owner.domain = domain;
        } catch (e) {}

        serverContextHandle = undefined;

        // publish sso on request.
        req.sso = sso;
      }
    } catch (e) {
      console.error(e);
      next(createError(400, `Unexpected error while doing SSO. Please contact your system administrator.`));
    }

    next();
  };
};
