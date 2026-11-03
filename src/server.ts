import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { sms } from './lib/sms.js';

const log = logger('server');
const app = createApp();

const server = app.listen(env.PORT, () => {
  log.info(`Oasis Fuel Rewards API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  log.info(
    sms.name === 'fast2sms'
      ? 'SMS provider: Fast2SMS (real SMS will be sent and charged)'
      : 'SMS provider: console (no FAST2SMS_API_KEY set; OTP codes are printed here, nothing is sent)',
  );
});

async function shutdown(signal: string) {
  log.info(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
