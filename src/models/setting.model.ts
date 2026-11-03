import { DEFAULT_SETTINGS } from '../config/constants.js';
import type { Db } from '../lib/prisma.js';

export interface SettingChanges {
  fuelRatePerLitre?: number;
  minFuelAmountRupees?: number;
  referralBonusPoints?: number;
}

export const SettingModel = {
  /** The single settings row, created with defaults on first access. */
  get: (db: Db) => db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...DEFAULT_SETTINGS } }),

  update: (db: Db, changes: SettingChanges) =>
    db.setting.upsert({ where: { id: 1 }, update: changes, create: { id: 1, ...DEFAULT_SETTINGS, ...changes } }),
};
