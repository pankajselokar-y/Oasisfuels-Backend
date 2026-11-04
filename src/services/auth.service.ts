import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { hashSecret, verifySecret } from '../lib/password.js';
import { CustomerModel } from '../models/customer.model.js';
import { StaffModel } from '../models/staff.model.js';
import { badRequest, forbidden, unauthorized } from '../utils/AppError.js';
import { CustomerService, type NewAccount } from './customer.service.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';

// Compared against when the account does not exist, so response time does not reveal which
// phone numbers or usernames are registered.
const DUMMY_HASH = await hashSecret('not-a-real-secret');

export const AuthService = {
  async customerLogin(phone: string, pin: string) {
    const customer = await CustomerModel.findByPhone(prisma, phone);
    const valid = await verifySecret(pin, customer?.pinHash ?? DUMMY_HASH);
    if (!customer || !valid) throw unauthorized('Incorrect phone number or PIN.');
    return { customer, ...(await SessionService.start({ id: customer.id, role: 'CUSTOMER' })) };
  },

  /** Self sign-up. With OTP_ENABLED the phone number must first be proven with an SMS code; otherwise no code is involved. */
  async registerCustomer(input: Omit<NewAccount, 'consumeOtpId'> & { otp?: string }) {
    const { otp, ...account } = input;
    let consumeOtpId: string | undefined;
    if (env.OTP_ENABLED) {
      if (!otp) throw badRequest('Enter the 6-digit code from the SMS.');
      consumeOtpId = await OtpService.verify(account.phone, 'REGISTER', otp);
    }
    const customer = await CustomerService.createAccount({ ...account, consumeOtpId });
    return { customer, ...(await SessionService.start({ id: customer.id, role: 'CUSTOMER' })) };
  },

  async resetCustomerPin(phone: string, otp: string, newPin: string) {
    const otpId = await OtpService.verify(phone, 'RESET_PIN', otp);
    await CustomerService.resetPin(phone, newPin, otpId);
  },

  async staffLogin(username: string, password: string) {
    const staff = await StaffModel.findByUsername(prisma, username);
    const valid = await verifySecret(password, staff?.passwordHash ?? DUMMY_HASH);
    if (!staff || !valid) throw unauthorized('Incorrect username or password.');
    if (!staff.active) throw forbidden('This account has been disabled. Contact an admin.');
    return { staff, ...(await SessionService.start({ id: staff.id, role: staff.role })) };
  },
};
