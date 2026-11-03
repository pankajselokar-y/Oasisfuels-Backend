import { TIERS } from '../config/constants.js';

type Tier = { key: string; label: string; min: number };

export interface TierInfo {
  current: Tier;
  next: Tier | null;
  pointsToNext: number;
}

export function getTierInfo(lifetimePoints: number): TierInfo {
  let index = 0;
  TIERS.forEach((tier, i) => {
    if (lifetimePoints >= tier.min) index = i;
  });
  const current: Tier = TIERS[index]!;
  const next: Tier | null = TIERS[index + 1] ?? null;
  return { current, next, pointsToNext: next ? next.min - lifetimePoints : 0 };
}
