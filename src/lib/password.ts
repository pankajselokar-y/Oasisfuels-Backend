import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export const hashSecret = (secret: string) => bcrypt.hash(secret, ROUNDS);
export const verifySecret = (secret: string, hash: string) => bcrypt.compare(secret, hash);
