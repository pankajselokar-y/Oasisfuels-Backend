import type { Setting } from '../generated/prisma/client.js';
import { badRequest } from './AppError.js';

/** Fuel entries below the minimum spend earn nothing, and one point is earned per litre. */
export function pointsForAmount(settings: Setting, amountRupees: number): number {
  if (amountRupees < settings.minFuelAmountRupees) {
    throw badRequest(`Fuel entry must be at least ₹${settings.minFuelAmountRupees} to qualify for reward points.`);
  }
  const points = Math.round(amountRupees / settings.fuelRatePerLitre);
  if (points < 1) throw badRequest('That amount is too small to earn a point.');
  return points;
}
