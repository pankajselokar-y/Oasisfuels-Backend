import { prisma } from '../lib/prisma.js';
import { hashSecret, verifySecret } from '../lib/password.js';
import { CustomerModel } from '../models/customer.model.js';
import { OtpModel } from '../models/otp.model.js';
import { RedemptionModel } from '../models/redemption.model.js';
import { SettingModel } from '../models/setting.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/prismaErrors.js';
import { toSkipTake, type Pagination } from '../utils/pagination.js';
import { creditPoints } from './points.service.js';
import { prepareVehicle, type VehicleInput } from './vehicle.service.js';

export interface NewAccount {
  name: string;
  phone: string;
  pin: string;
  vehicle?: VehicleInput;
  /** A friend's mobile number; they earn the referral bonus once this account exists. */
  referralCode?: string;
  /** A verified OTP to spend as part of creating the account (set by self sign-up, not by staff). */
  consumeOtpId?: string;
}

const OTP_EXPIRED = 'This code has expired or was already used. Please request a new one.';

export const CustomerService = {
  /** The sign-up rules that don't need the SMS code, so the app can reject bad details before spending one. */
  async checkRegistration(input: { phone: string; vehicle?: VehicleInput; referralCode?: string }) {
    if (input.vehicle?.model && !input.vehicle.number?.trim()) {
      throw badRequest('Enter the vehicle number along with the vehicle model.');
    }
    if (input.vehicle?.number?.trim()) prepareVehicle(input.vehicle);
    if (await CustomerModel.findByPhone(prisma, input.phone)) {
      throw conflict('A customer with this phone number already exists. Please log in instead.');
    }
    const referral = input.referralCode?.trim();
    if (referral) {
      if (referral === input.phone) throw badRequest('You cannot refer yourself.');
      if (!(await CustomerModel.findByPhone(prisma, referral))) throw badRequest('Referral code not found.');
    }
  },

  /**
   * Shared by self sign-up and by a cashier/admin registering a walk-in customer.
   * The new account, the optional first vehicle and the referrer's bonus commit together.
   */
  async createAccount(input: NewAccount) {
    if (input.vehicle?.model && !input.vehicle.number?.trim()) {
      throw badRequest('Enter the vehicle number along with the vehicle model.');
    }
    const vehicle = input.vehicle?.number?.trim() ? prepareVehicle(input.vehicle) : null;
    const pinHash = await hashSecret(input.pin);
    const referralPhone = input.referralCode?.trim() || null;

    try {
      return await prisma.$transaction(async (tx) => {
        if (await CustomerModel.findByPhone(tx, input.phone)) {
          throw conflict('A customer with this phone number already exists.');
        }
        // Spent in the same transaction as the account, so if anything below fails the code is still usable.
        if (input.consumeOtpId && !(await OtpModel.consume(tx, input.consumeOtpId))) throw badRequest(OTP_EXPIRED);

        let referrer: { id: string; name: string } | null = null;
        if (referralPhone) {
          if (referralPhone === input.phone) throw badRequest('You cannot refer yourself.');
          const found = await CustomerModel.findByPhone(tx, referralPhone);
          if (!found) throw badRequest('Referral code not found.');
          referrer = { id: found.id, name: found.name };
        }

        const created = await CustomerModel.create(tx, {
          phone: input.phone,
          pinHash,
          name: input.name.trim(),
          referredById: referrer?.id ?? null,
          vehicle,
        });

        // Both sides win: the friend who shared the code and the friend who joined with it each get the bonus.
        if (referrer) {
          const settings = await SettingModel.get(tx);
          await creditPoints(tx, {
            customerId: referrer.id,
            points: settings.referralBonusPoints,
            label: `Referral bonus: ${created.name} joined using your code`,
            source: 'REFERRAL',
          });
          await creditPoints(tx, {
            customerId: created.id,
            points: settings.referralBonusPoints,
            label: `Welcome bonus: you joined using ${referrer.name}'s referral code`,
            source: 'REFERRAL',
          });
          // Re-read so the returned account carries the welcome bonus.
          return (await CustomerModel.findById(tx, created.id)) ?? created;
        }
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('A customer with this phone number already exists.');
      throw error;
    }
  },

  /** A customer with the numbers the app shows on its dashboard. */
  async profile(customerId: string) {
    const customer = await CustomerModel.findById(prisma, customerId);
    if (!customer) throw notFound('Customer not found.');
    const [redeemedCount, pendingPoints] = await Promise.all([
      TransactionModel.redeemedCountFor(prisma, customerId),
      RedemptionModel.pendingPoints(prisma, customerId),
    ]);
    return {
      customer,
      stats: { redeemedCount, pendingPoints, availablePoints: customer.points - pendingPoints },
    };
  },

  async list(search: string | undefined, pagination: Pagination) {
    const { skip, take } = toSkipTake(pagination);
    const [customers, total] = await Promise.all([
      CustomerModel.search(prisma, search, skip, take),
      CustomerModel.count(prisma, search),
    ]);
    return { customers, total };
  },

  async get(customerId: string) {
    const customer = await CustomerModel.findById(prisma, customerId);
    if (!customer) throw notFound('Customer not found.');
    return customer;
  },

  async updateName(customerId: string, name: string) {
    return CustomerModel.update(prisma, customerId, { name: name.trim() });
  },

  async changePin(customerId: string, currentPin: string, newPin: string) {
    const customer = await CustomerModel.findById(prisma, customerId);
    if (!customer) throw notFound('Customer not found.');
    if (!(await verifySecret(currentPin, customer.pinHash))) throw badRequest('Current PIN is incorrect.');
    await CustomerModel.update(prisma, customerId, { pinHash: await hashSecret(newPin) });
  },

  /** Forgot-PIN: sets a new PIN after the SMS code has been verified, spending that code atomically. */
  async resetPin(phone: string, newPin: string, otpId: string) {
    const pinHash = await hashSecret(newPin);
    await prisma.$transaction(async (tx) => {
      if (!(await OtpModel.consume(tx, otpId))) throw badRequest(OTP_EXPIRED);
      const customer = await CustomerModel.findByPhone(tx, phone);
      if (!customer) throw notFound('Customer not found.');
      await CustomerModel.update(tx, customer.id, { pinHash });
      // Whoever had the old PIN (including a thief) must sign in again.
      await tx.refreshToken.updateMany({ where: { subjectId: customer.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  },

  async history(customerId: string, pagination: Pagination) {
    const { skip, take } = toSkipTake(pagination);
    const [transactions, total] = await Promise.all([
      TransactionModel.listForCustomer(prisma, customerId, skip, take),
      TransactionModel.countForCustomer(prisma, customerId),
    ]);
    return { transactions, total };
  },
};
