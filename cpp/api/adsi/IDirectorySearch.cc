#include "IDirectorySearch.h"
#include "../../log.h"

#include "../../pointer.h"
#include "../../polyfill.h"

#include <atlbase.h>
#include <comutil.h>

namespace myAddon {

Napi::FunctionReference E_IDirectorySearch::constructor;

Napi::Object E_IDirectorySearch::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(
      env, "IDirectorySearch", {InstanceMethod("Release", &E_IDirectorySearch::Release)});

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("IDirectorySearch", func);
  return exports;
}

E_IDirectorySearch::E_IDirectorySearch(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<E_IDirectorySearch>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Napi::String str = info[0].As<Napi::String>();
  IDirectorySearch* iDirectorySearch = (IDirectorySearch*)s2p(str.Utf8Value());
  this->iDirectorySearch = iDirectorySearch;
}

Napi::Object E_IDirectorySearch::NewInstance(Napi::Env env, Napi::Value arg) {
  Napi::EscapableHandleScope scope(env);
  Napi::Object obj = constructor.New({arg});
  return scope.Escape(napi_value(obj)).ToObject();
}

void E_IDirectorySearch::Release(const Napi::CallbackInfo& info) {
  this->iDirectorySearch->Release();
}

}  // namespace myAddon