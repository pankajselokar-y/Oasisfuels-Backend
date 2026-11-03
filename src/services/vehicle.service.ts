import { prisma } from '../lib/prisma.js';
import { VehicleModel } from '../models/vehicle.model.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/prismaErrors.js';
import { VEHICLE_FORMAT_ERROR, compactVehicleNumber, formatVehicleNumber } from '../utils/vehicleNumber.js';

export interface VehicleInput {
  number: string;
  model?: string;
}

/** Validates a plate and returns the values to store (standard spaced form + a compact key). */
export function prepareVehicle(input: VehicleInput) {
  const number = formatVehicleNumber(input.number);
  if (!number) throw badRequest(VEHICLE_FORMAT_ERROR);
  return { model: (input.model ?? '').trim(), number, numberKey: compactVehicleNumber(number) };
}

const DUPLICATE = 'This vehicle number is already on your profile.';

export const VehicleService = {
  list: (customerId: string) => VehicleModel.listByCustomer(prisma, customerId),

  async add(customerId: string, input: VehicleInput) {
    try {
      return await VehicleModel.create(prisma, customerId, prepareVehicle(input));
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(DUPLICATE);
      throw error;
    }
  },

  async update(customerId: string, vehicleId: string, input: VehicleInput) {
    const existing = await VehicleModel.findOwned(prisma, customerId, vehicleId);
    if (!existing) throw notFound('Vehicle not found.');
    try {
      return await VehicleModel.update(prisma, vehicleId, prepareVehicle(input));
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(DUPLICATE);
      throw error;
    }
  },

  async remove(customerId: string, vehicleId: string) {
    const existing = await VehicleModel.findOwned(prisma, customerId, vehicleId);
    if (!existing) throw notFound('Vehicle not found.');
    // Past fuel proofs keep their own copy of the plate, so removing a vehicle loses no history.
    await VehicleModel.remove(prisma, vehicleId);
  },
};
