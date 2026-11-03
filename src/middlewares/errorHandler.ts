import type { ErrorRequestHandler, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/AppError.js';

const log = logger('error');

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

const send = (status: number, code: string, message: string, details?: unknown): [number, ErrorBody] => [
  status,
  { error: { code, message, ...(details !== undefined ? { details } : {}) } },
];

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status: number;
  let body: ErrorBody;

  if (err instanceof AppError) {
    [status, body] = send(err.status, err.code, err.message, err.details);
  } else if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    [status, body] = send(400, 'VALIDATION_ERROR', details[0]?.message ?? 'Invalid request.', details);
  } else if (err instanceof jwt.JsonWebTokenError) {
    [status, body] = send(401, 'UNAUTHORIZED', 'Invalid or expired token.');
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    [status, body] = send(409, 'CONFLICT', 'That record already exists.');
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    [status, body] = send(404, 'NOT_FOUND', 'Record not found.');
  } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    // body-parser errors: malformed JSON, payload too large, ...
    [status, body] = send(err.status, 'BAD_REQUEST', err.type === 'entity.parse.failed' ? 'Malformed JSON body.' : err.message);
  } else {
    log.error(`Unhandled error: ${String(err?.message ?? err)}`, err?.stack);
    [status, body] = send(500, 'INTERNAL_ERROR', isProduction ? 'Something went wrong.' : String(err?.message ?? err));
  }

  res.status(status).json(body);
};
