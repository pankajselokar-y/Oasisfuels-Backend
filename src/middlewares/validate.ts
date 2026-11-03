import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

/** Parses (and coerces) the request against Zod schemas; failures become a 400 via the error handler. */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    next();
  };
