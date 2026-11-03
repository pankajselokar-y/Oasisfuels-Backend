import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

const log = logger('http');

/** One line per request once it finishes: method, path, status, time. Bodies and headers are never logged. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(0)}ms ip=${req.ip}`;
    if (res.statusCode >= 500) log.error(line);
    else if (res.statusCode >= 400) log.warn(line);
    else log.info(line);
  });
  next();
};
