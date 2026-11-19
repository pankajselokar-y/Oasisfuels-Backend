import { prisma, type Db } from '../lib/prisma.js';
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

export const PLATE_ON_OWN_PROFILE = 'This vehicle number is already on your profile.';
export const PLATE_ON_OTHER_PROFILE = 'This vehicle number is already registered to another customer.';

/**
 * A plate belongs to exactly one customer, whoever adds it (the customer, or staff on their behalf), so the same vehicle can
 * never earn points on two profiles. `customerId` is the person who would hold it; `exceptVehicleId` is a vehicle being edited.
 */
export async function assertPlateAvailable(
  db: Db,
  numberKey: string,
  { customerId, exceptVehicleId }: { customerId?: string; exceptVehicleId?: string } = {},
) {
  const holder = await VehicleModel.findByKey(db, numberKey);
  if (!holder || holder.id === exceptVehicleId) return;
  throw conflict(customerId && holder.customerId === customerId ? PLATE_ON_OWN_PROFILE : PLATE_ON_OTHER_PROFILE);
}

export const VehicleService = {
  list: (customerId: string) => VehicleModel.listByCustomer(prisma, customerId),

  async add(customerId: string, input: VehicleInput) {
    const vehicle = prepareVehicle(input);
    await assertPlateAvailable(prisma, vehicle.numberKey, { customerId });
    try {
      return await VehicleModel.create(prisma, customerId, vehicle);
    } catch (error) {
      // Two requests for the same plate at the same moment: the database lets only one through.
      if (isUniqueViolation(error)) throw conflict(PLATE_ON_OTHER_PROFILE);
      throw error;
    }
  },

  async update(customerId: string, vehicleId: string, input: VehicleInput) {
    const existing = await VehicleModel.findOwned(prisma, customerId, vehicleId);
    if (!existing) throw notFound('Vehicle not found.');
    const vehicle = prepareVehicle(input);
    await assertPlateAvailable(prisma, vehicle.numberKey, { customerId, exceptVehicleId: vehicleId });
    try {
      return await VehicleModel.update(prisma, vehicleId, vehicle);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(PLATE_ON_OTHER_PROFILE);
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
