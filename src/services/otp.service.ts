import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP } from '../config/constants.js';
import { env, isProduction } from '../config/env.js';
import { logger, maskPhone } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { sms } from '../lib/sms.js';
import type { OtpPurpose } from '../generated/prisma/client.js';
import { CustomerModel } from '../models/customer.model.js';
import { OtpModel } from '../models/otp.model.js';
import { AppError, badRequest, conflict } from '../utils/AppError.js';

const log = logger('otp');

const HOUR_MS = 60 * 60 * 1000;

const PURPOSE_TEXT: Record<OtpPurpose, string> = {
  REGISTER: 'to register',
  RESET_PIN: 'to reset your PIN',
};

/** Keyed hash, so a leaked table cannot be turned back into usable codes. */
function hashCode(phone: string, purpose: OtpPurpose, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${phone}:${purpose}:${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export const OtpService = {
  /**
   * Texts a one-time code. Each SMS costs money, so this is limited per phone (cooldown + hourly cap) on top of
   * the per-IP limiter on the route.
   */
  async send(phone: string, purpose: OtpPurpose) {
    const customer = await CustomerModel.findByPhone(prisma, phone);
    if (purpose === 'REGISTER' && customer) {
      log.warn(`send ${purpose} refused for ${maskPhone(phone)}: already registered`);
      throw conflict('A customer with this phone number already exists.');
    }

    const response = {
      sent: true,
      expiresInSeconds: OTP.ttlMinutes * 60,
      resendInSeconds: OTP.resendCooldownSeconds,
    };

    // Do not reveal which numbers are registered: a reset for an unknown number looks like a success.
    if (purpose === 'RESET_PIN' && !customer) {
      log.info(`send ${purpose} for unregistered ${maskPhone(phone)}: pretending success, nothing sent`);
      return response;
    }

    const last = await OtpModel.latestCreatedAt(prisma, phone, purpose);
    if (last) {
      const wait = Math.ceil(OTP.resendCooldownSeconds - (Date.now() - last.getTime()) / 1000);
      if (wait > 0) {
        log.warn(`send ${purpose} to ${maskPhone(phone)} blocked: cooldown, ${wait}s left`);
        throw new AppError(429, 'OTP_COOLDOWN', `Please wait ${wait} seconds before requesting another code.`);
      }
    }
    const sentThisHour = await OtpModel.countSince(prisma, phone, purpose, new Date(Date.now() - HOUR_MS));
    if (sentThisHour >= OTP.maxSendsPerHour) {
      log.warn(`send ${purpose} to ${maskPhone(phone)} blocked: ${sentThisHour} codes in the last hour`);
      throw new AppError(429, 'OTP_LIMIT', 'Too many codes requested for this number. Please try again in an hour.');
    }

    const code = String(randomInt(0, 10 ** OTP.length)).padStart(OTP.length, '0');
    const record = await prisma.$transaction(async (tx) => {
      await OtpModel.invalidateActive(tx, phone, purpose);
      return OtpModel.create(tx, {
        phone,
        purpose,
        codeHash: hashCode(phone, purpose, code),
        expiresAt: new Date(Date.now() + OTP.ttlMinutes * 60 * 1000),
      });
    });

    try {
      await sms.send(
        phone,
        `Your Oasis Fuel OTP ${PURPOSE_TEXT[purpose]} is ${code}. Valid for ${OTP.ttlMinutes} minutes. Do not share it with anyone.`,
      );
    } catch (error) {
      log.error(`send ${purpose} to ${maskPhone(phone)} failed via ${sms.name}; code discarded`);
      // The customer never received it, so do not let it count against their cooldown.
      await OtpModel.remove(prisma, record.id);
      throw error;
    }

    log.info(`send ${purpose} to ${maskPhone(phone)} ok via ${sms.name}, expires in ${OTP.ttlMinutes} min`);
    void OtpModel.purgeOlderThanOneDay(prisma).catch(() => undefined);

    // Handy for local development and tests; never exposed when a real SMS is sent.
    return !isProduction && sms.name === 'console' ? { ...response, devOtp: code } : response;
  },

  /**
   * Checks a code and returns its id. The caller consumes it (inside its own transaction) once the action it
   * unlocks has succeeded, so a failed sign-up does not burn the customer's code.
   */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<string> {
    const record = await OtpModel.findActive(prisma, phone, purpose);
    if (!record) {
      log.warn(`verify ${purpose} for ${maskPhone(phone)}: no active code`);
      throw badRequest('This code has expired or was never requested. Please request a new one.');
    }
    if (record.attempts >= OTP.maxAttempts) {
      log.warn(`verify ${purpose} for ${maskPhone(phone)}: locked after ${record.attempts} wrong attempts`);
      throw badRequest('Too many wrong attempts. Please request a new code.');
    }

    if (!sameHash(record.codeHash, hashCode(phone, purpose, code))) {
      await OtpModel.addFailedAttempt(prisma, record.id);
      log.warn(`verify ${purpose} for ${maskPhone(phone)}: wrong code (attempt ${record.attempts + 1}/${OTP.maxAttempts})`);
      throw badRequest('Incorrect code.');
    }
    log.info(`verify ${purpose} for ${maskPhone(phone)}: correct code`);
    return record.id;
  },
};
