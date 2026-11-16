import { prisma } from '../lib/prisma.js';
import { SettingModel, type SettingChanges } from '../models/setting.model.js';
import { badRequest } from '../utils/AppError.js';

export const SettingService = {
  get: () => SettingModel.get(prisma),
  async update(changes: SettingChanges) {
    // Checked against the values as they will be after the change, so one field cannot quietly break the other.
    const current = await SettingModel.get(prisma);
    const rate = changes.fuelRatePerLitre ?? current.fuelRatePerLitre;
    const minimum = changes.minFuelAmountRupees ?? current.minFuelAmountRupees;
    const floor = Math.ceil(rate / 2);
    if (minimum < floor) {
      throw badRequest(`The minimum fill-up must be at least ₹${floor} (half the fuel rate), or the smallest allowed fill-up would earn no points.`);
    }
    return SettingModel.update(prisma, changes);
  },
};
