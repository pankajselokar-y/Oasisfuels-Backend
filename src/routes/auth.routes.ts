import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authIpLimiter, loginAttemptLimiter, otpSendIpLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  checkRegistrationBody,
  customerLoginBody,
  refreshBody,
  registerBody,
  resetPinBody,
  sendOtpBody,
  staffLoginBody,
  verifyOtpBody,
} from '../validators/auth.validator.js';

export const authRoutes = Router();

authRoutes.use(authIpLimiter);

authRoutes.post('/register/check', validate({ body: checkRegistrationBody }), auth.checkRegistration);
authRoutes.post('/otp/send', validate({ body: sendOtpBody }), otpSendIpLimiter, auth.sendOtp);
authRoutes.post('/otp/verify', validate({ body: verifyOtpBody }), auth.verifyOtp);
authRoutes.post('/customer/reset-pin', validate({ body: resetPinBody }), auth.resetPin);
authRoutes.post('/customer/login', validate({ body: customerLoginBody }), loginAttemptLimiter, auth.customerLogin);
authRoutes.post('/customer/register', validate({ body: registerBody }), auth.registerCustomer);
authRoutes.post('/staff/login', validate({ body: staffLoginBody }), loginAttemptLimiter, auth.staffLogin);
authRoutes.post('/refresh', validate({ body: refreshBody }), auth.refresh);
authRoutes.post('/logout', validate({ body: refreshBody }), auth.logout);
authRoutes.get('/me', authenticate, auth.me);
