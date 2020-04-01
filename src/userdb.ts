import { adsi } from '../lib/api';
import { IDirectorySearch, IADs } from '../lib/adsi';
import { isOnDomain } from './domain';
import dbg from 'debug';
import { Database, ADUser, ADUsers } from './interfaces';

const debug = dbg('node-expose-sspi:userdb');

export const database: Database = {
  users: [],
};

export async function init() {
  if (!isOnDomain()) {
    return;
  }
  try {
    debug('init');
    // request all accounts from domain
    database.users = await getUsers();
  } catch (e) {
    debug('Cannot get users from AD. e: ', e);
  }
}

export async function getUser(ldapFilter: string): Promise<ADUser> {
  if (!isOnDomain()) {
    return;
  }
  adsi.CoInitializeEx(['COINIT_MULTITHREADED']);

  const distinguishedName = await getDistinguishedName();
  const dirsearch = await adsi.ADsOpenObject<IDirectorySearch>({
    binding: `LDAP://${distinguishedName}`,
    riid: 'IID_IDirectorySearch',
  });
  dirsearch.SetSearchPreference();
  dirsearch.ExecuteSearch({
    filter: `(&(objectClass=user)(objectCategory=person)${ldapFilter})`,
  });

  let row: ADUser;
  const hr = dirsearch.GetNextRow();
  if (hr === adsi.S_ADS_NOMORE_ROWS) {
    dirsearch.Release();
    adsi.CoUninitialize();
    return undefined;
  }
  row = {};
  let colName = dirsearch.GetNextColumnName();
  while (colName !== adsi.S_ADS_NOMORE_COLUMNS) {
    const value = await dirsearch.GetColumn(colName as string);
    row[colName] = value;
    colName = dirsearch.GetNextColumnName();
  }

  dirsearch.Release();
  adsi.CoUninitialize();
  return row;
}

export async function getUsers(): Promise<ADUsers> {
  if (!isOnDomain()) {
    return;
  }
  const result: ADUsers = [];
  adsi.CoInitializeEx(['COINIT_MULTITHREADED']);
  let dirsearch;
  try {
    const distinguishedName = await getDistinguishedName();
    dirsearch = await adsi.ADsOpenObject<IDirectorySearch>({
      binding: `LDAP://${distinguishedName}`,
      riid: 'IID_IDirectorySearch',
    });
    dirsearch.SetSearchPreference();
    dirsearch.ExecuteSearch({
      filter: '(&(objectClass=user)(objectCategory=person)(sn=*))',
    });

    while (true) {
      if (dirsearch.GetNextRow() === adsi.S_ADS_NOMORE_ROWS) {
        break;
      }
      const row: ADUser = {};
      let colName = dirsearch.GetNextColumnName();
      while (colName !== adsi.S_ADS_NOMORE_COLUMNS) {
        const value = await dirsearch.GetColumn(colName as string);
        row[colName] = value;
        colName = dirsearch.GetNextColumnName();
      }
      result.push(row);
    }
  } catch (error) {
    console.log('error: ', error);
  } finally {
    dirsearch && dirsearch.Release();
    adsi.CoUninitialize();
  }
  return result;
}

export async function getDistinguishedName(): Promise<string> {
  if (!isOnDomain()) {
    return;
  }
  let root: IADs;
  try {
    root = await adsi.ADsGestObject('LDAP://rootDSE');
    const distinguishedName = await root.Get('defaultNamingContext');
    return distinguishedName;
  } finally {
    root && root.Release();
  }
}
