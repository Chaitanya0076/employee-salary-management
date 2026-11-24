export type Role = 'HR_MANAGER';

/** The authenticated user as exposed to the rest of the app and to clients. */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

/** What the repository returns: the public user plus the stored hash. */
export interface AuthUserRecord extends AuthUser {
  passwordHash: string;
}

export interface TokenClaims {
  userId: number;
  role: Role;
}
