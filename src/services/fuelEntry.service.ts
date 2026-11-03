import { prisma } from '../lib/prisma.js';
import { CustomerModel } from '../models/customer.model.js';
import { SettingModel } from '../models/setting.model.js';
import { notFound } from '../utils/AppError.js';
import { pointsForAmount } from '../utils/fuel.js';
import { creditPoints } from './points.service.js';

export const FuelEntryService = {
  /**
   * A cashier records a fill-up at the counter. The cashier may give the rupees paid or the litres
   * dispensed; either is converted with the configured rate.
   */
  async record(input: { customerId: string; amountRupees?: number; litres?: number; staffId: string }) {
    return prisma.$transaction(async (tx) => {
      const settings = await SettingModel.get(tx);
      const amountRupees = input.amountRupees ?? Math.round((input.litres ?? 0) * settings.fuelRatePerLitre);
      const points = pointsForAmount(settings, amountRupees);

      if (!(await CustomerModel.findById(tx, input.customerId))) throw notFound('Customer not found.');

      const { customer, transaction, unlockedRewards } = await creditPoints(tx, {
        customerId: input.customerId,
        points,
        label: `Fuel purchase: ${points} ltr`,
        source: 'FUEL_ENTRY',
        fuelAmountRupees: amountRupees,
        staffId: input.staffId,
      });

      return {
        customer,
        transaction,
        amountRupees,
        litres: points,
        pointsEarned: points,
        unlockedRewards,
      };
    });
  },
};
