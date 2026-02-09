export interface UserInfo {
  username: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface AllUserInfo {
  username: string;
  email: string;
  name: string;
  isAdmin: boolean;
  groups: string[];
}

export interface UserDataResponse {
  currentUser: UserInfo;
  allUsers: AllUserInfo[];
}