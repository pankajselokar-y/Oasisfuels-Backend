import type { Request, Response } from 'express';
import type { AuthPayload } from '../lib/jwt.js';

export const ok = (res: Response, data: unknown, meta?: unknown) =>
  res.json(meta === undefined ? { data } : { data, meta });

export const created = (res: Response, data: unknown) => res.status(201).json({ data });

/** The caller, as set by the `authenticate` middleware. */
export const authOf = (req: Request): AuthPayload => req.auth!;

/** The validated + coerced query string. */
export const queryOf = <T>(req: Request): T => req.validatedQuery as T;
