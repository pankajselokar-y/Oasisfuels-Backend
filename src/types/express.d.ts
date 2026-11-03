import type { AuthPayload } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. */
      auth?: AuthPayload;
      /** Query string after validation/coercion (Express 5 makes `req.query` read-only). */
      validatedQuery?: unknown;
    }
  }
}

export {};
