import {
  UserTable,
  RefreshTokenTable,
  SignInMethodTable,
  PasswordSignInMethodTable,
} from './tables';

export interface Database {
  user: UserTable;
  refresh_token: RefreshTokenTable;
  sign_in_method: SignInMethodTable;
  password_sign_in_method: PasswordSignInMethodTable;
}
