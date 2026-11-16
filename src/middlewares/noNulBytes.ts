import type { RequestHandler } from 'express';
import { badRequest } from '../utils/AppError.js';

/**
 * PostgreSQL cannot store the NUL character in text, so one slipping into a name, plate or search would otherwise surface as a
 * 500 from the database. Nothing legitimate contains it, so any request that does is refused up front.
 */
export const noNulBytes: RequestHandler = (req, _res, next) => {
  const inQuery = Object.values(req.query).some((value) => JSON.stringify(value).includes('\\u0000'));
  const inBody = req.body !== undefined && JSON.stringify(req.body)?.includes('\\u0000');
  if (inQuery || inBody) throw badRequest('The request contains characters that are not allowed.');
  next();
};
