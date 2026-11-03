import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, isProduction } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // On Render the server sits behind one proxy; without this every client would share the proxy's IP in the rate limiters.
  if (isProduction) app.set('trust proxy', 1);
  app.use(helmet());

  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins.includes('*') ? true : origins }));

  app.use(requestLogger);
  // A fuel entry carries the dashboard photo as a base64 data URI, so that route gets a larger body limit.
  app.use('/api/v1/fuel-entries', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
