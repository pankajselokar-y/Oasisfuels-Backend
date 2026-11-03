import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type Role = 'CUSTOMER' | 'ADMIN' | 'CASHIER';

export interface AuthPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
}

export function verifyToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || !decoded['role']) {
    throw new Error('Malformed token');
  }
  return { sub: decoded.sub, role: decoded['role'] as Role };
}
