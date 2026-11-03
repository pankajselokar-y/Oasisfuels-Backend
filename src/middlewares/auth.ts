import type { RequestHandler } from 'express';
import { verifyToken, type Role } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { StaffModel } from '../models/staff.model.js';
import { forbidden, unauthorized } from '../utils/AppError.js';

/** Requires a valid Bearer token. Staff accounts are re-checked in the database on every call. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let payload;
  try {
    payload = verifyToken(header.slice('Bearer '.length));
  } catch {
    throw unauthorized('Invalid or expired token.');
  }

  if (payload.role !== 'CUSTOMER') {
    // A disabled or demoted staff member loses access immediately, not when the token expires.
    const staff = await StaffModel.findById(prisma, payload.sub);
    if (!staff || !staff.active) throw unauthorized('This account is no longer active.');
    payload = { sub: staff.id, role: staff.role };
  }

  req.auth = payload;
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) throw forbidden();
    next();
  };

export const customerOnly = requireRole('CUSTOMER');
export const staffOnly = requireRole('ADMIN', 'CASHIER');
export const adminOnly = requireRole('ADMIN');
export const cashierOnly = requireRole('CASHIER');
