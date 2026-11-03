import type { RequestHandler } from 'express';
import { AuthService } from '../services/auth.service.js';
import { CustomerService } from '../services/customer.service.js';
import { OtpService } from '../services/otp.service.js';
import { StaffService } from '../services/staff.service.js';
import { authOf, created, ok } from '../utils/http.js';
import { customerDto, staffDto } from '../utils/serializers.js';

export const customerLogin: RequestHandler = async (req, res) => {
  const { customer, token } = await AuthService.customerLogin(req.body.phone, req.body.pin);
  ok(res, { token, role: 'CUSTOMER', customer: customerDto(customer) });
};

export const registerCustomer: RequestHandler = async (req, res) => {
  const { vehicle, ...rest } = req.body;
  const { customer, token } = await AuthService.registerCustomer({ ...rest, vehicle });
  created(res, { token, role: 'CUSTOMER', customer: customerDto(customer) });
};

export const checkRegistration: RequestHandler = async (req, res) => {
  await CustomerService.checkRegistration(req.body);
  ok(res, { ok: true });
};

export const sendOtp: RequestHandler = async (req, res) => {
  ok(res, await OtpService.send(req.body.phone, req.body.purpose));
};

export const verifyOtp: RequestHandler = async (req, res) => {
  // Wrong guesses are counted (and the code locked after 5); a correct code is not consumed here.
  await OtpService.verify(req.body.phone, req.body.purpose, req.body.otp);
  ok(res, { verified: true });
};

export const resetPin: RequestHandler = async (req, res) => {
  await AuthService.resetCustomerPin(req.body.phone, req.body.otp, req.body.newPin);
  ok(res, { reset: true });
};

export const staffLogin: RequestHandler = async (req, res) => {
  const { staff, token } = await AuthService.staffLogin(req.body.username, req.body.password);
  ok(res, { token, role: staff.role, staff: staffDto(staff) });
};

/** Who am I? Returns the signed-in customer (with dashboard stats) or staff member. */
export const me: RequestHandler = async (req, res) => {
  const auth = authOf(req);
  if (auth.role === 'CUSTOMER') {
    const { customer, stats } = await CustomerService.profile(auth.sub);
    return ok(res, { role: auth.role, customer: { ...customerDto(customer), stats } });
  }
  ok(res, { role: auth.role, staff: staffDto(await StaffService.get(auth.sub)) });
};
