import type {
  Customer,
  FuelClaim,
  PointTransaction,
  RedemptionRequest,
  Reward,
  Setting,
  Staff,
  Vehicle,
} from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { getTierInfo } from './tiers.js';

type Person = { id: string; name: string; phone?: string } | null;

export const vehicleDto = (v: Vehicle) => ({ id: v.id, model: v.model, number: v.number });

/** Public shape of a customer. The PIN hash is never included. */
export const customerDto = (c: Customer & { vehicles?: Vehicle[] }) => ({
  id: c.id,
  phone: c.phone,
  name: c.name,
  points: c.points,
  lifetimePoints: c.lifetimePoints,
  /** A customer's referral code is simply their mobile number. */
  referralCode: c.phone,
  tier: getTierInfo(c.lifetimePoints),
  joinedAt: c.createdAt,
  ...(c.vehicles ? { vehicles: c.vehicles.map(vehicleDto) } : {}),
});

export const rewardDto = (r: Reward) => ({ id: r.id, name: r.name, icon: r.icon, points: r.points });

export const transactionDto = (t: PointTransaction & { performedBy?: { id: string; name: string } | null }) => ({
  id: t.id,
  type: t.type,
  source: t.source,
  label: t.label,
  amount: t.amount,
  fuelAmountRupees: t.fuelAmountRupees,
  performedBy: t.performedBy?.name ?? null,
  createdAt: t.createdAt,
});

export const redemptionDto = (r: RedemptionRequest & { customer?: Person; resolvedBy?: Person }) => ({
  id: r.id,
  status: r.status,
  reward: { id: r.rewardId, name: r.rewardName, icon: r.rewardIcon, points: r.points },
  ...(r.customer ? { customer: r.customer } : {}),
  requestedAt: r.requestedAt,
  resolvedAt: r.resolvedAt,
  resolvedBy: r.resolvedBy?.name ?? null,
});

export const fuelClaimDto = (c: FuelClaim & { customer?: Person; resolvedBy?: Person }) => ({
  id: c.id,
  status: c.status,
  ...(c.customer ? { customer: c.customer } : {}),
  vehicle: { id: c.vehicleId, model: c.vehicleModel, number: c.vehicleNumber },
  claimedAmountRupees: c.claimedAmountRupees,
  location: { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy },
  photoUrl: `/api/v1/fuel-claims/${c.id}/photo`,
  submittedAt: c.submittedAt,
  resolvedAt: c.resolvedAt,
  resolvedBy: c.resolvedBy?.name ?? null,
  approvedAmountRupees: c.approvedAmountRupees,
  pointsAwarded: c.pointsAwarded,
  rejectionReason: c.rejectionReason,
});

export const staffDto = (s: Staff) => ({
  id: s.id,
  name: s.name,
  username: s.username,
  role: s.role,
  active: s.active,
  createdAt: s.createdAt,
});

export const settingsDto = (s: Setting) => ({
  fuelRatePerLitre: s.fuelRatePerLitre,
  minFuelAmountRupees: s.minFuelAmountRupees,
  referralBonusPoints: s.referralBonusPoints,
  /** Whether sign-up / forgot-PIN use an SMS code; the app hides those steps when false. */
  otpEnabled: env.OTP_ENABLED,
  updatedAt: s.updatedAt,
});
