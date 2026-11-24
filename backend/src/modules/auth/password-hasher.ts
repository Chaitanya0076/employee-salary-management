import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
  /**
   * A valid hash of a random value with the same cost. Comparing against it when
   * the email is unknown makes both failure paths take the same time, so response
   * timing does not reveal which emails exist.
   */
  readonly dummyHash: string;
}

/** Cost 12 in production (matches the seed); tests use a low cost for speed. */
export function createBcryptPasswordHasher(cost = 12): PasswordHasher {
  return {
    hash: (plain) => bcrypt.hash(plain, cost),
    verify: (plain, hash) => bcrypt.compare(plain, hash),
    dummyHash: bcrypt.hashSync(randomBytes(16).toString('hex'), cost),
  };
}
