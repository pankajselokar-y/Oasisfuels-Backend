import { randomUUID } from 'node:crypto';
import { ALLOWED_PHOTO_TYPES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { detectImageType, removeUpload, saveFuelPhoto } from '../lib/storage.js';
import { CustomerModel } from '../models/customer.model.js';
import { FuelClaimModel } from '../models/fuelClaim.model.js';
import { SettingModel } from '../models/setting.model.js';
import { VehicleModel } from '../models/vehicle.model.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { pointsForAmount } from '../utils/fuel.js';
import { creditPoints } from './points.service.js';
import { prepareVehicle } from './vehicle.service.js';

export interface FuelProof {
  vehicleId?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  photo: Buffer;
}

export const FuelEntryService = {
  /**
   * A cashier records a fill-up at the counter. The cashier may give the rupees paid or the litres
   * dispensed; either is converted with the configured rate. The dashboard photo, GPS and vehicle the cashier
   * captured are kept as a fuel proof that is stored already approved (the cashier is the one vouching for it).
   */
  async record(input: { customerId: string; amountRupees?: number; litres?: number; staffId: string; proof?: FuelProof }) {
    // The photo is checked and written before the transaction starts, which keeps the transaction short.
    let saved: { id: string; path: string; mime: string } | null = null;
    if (input.proof) {
      const mime = detectImageType(input.proof.photo);
      if (!mime || !(ALLOWED_PHOTO_TYPES as readonly string[]).includes(mime)) {
        throw badRequest('The photo must be a JPEG, PNG or WebP image.');
      }
      const id = randomUUID();
      saved = { id, path: await saveFuelPhoto(id, input.proof.photo, mime), mime };
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const settings = await SettingModel.get(tx);
        const amountRupees = input.amountRupees ?? Math.round((input.litres ?? 0) * settings.fuelRatePerLitre);
        const points = pointsForAmount(settings, amountRupees);

        if (!(await CustomerModel.findById(tx, input.customerId))) throw notFound('Customer not found.');

        // The vehicle is a saved one of this customer's, or a plate typed in (validated and stored spaced/uppercase).
        let vehicle: { vehicleId: string | null; vehicleModel: string; vehicleNumber: string } | null = null;
        if (input.proof) {
          if (input.proof.vehicleId) {
            const owned = await VehicleModel.findOwned(tx, input.customerId, input.proof.vehicleId);
            if (!owned) throw badRequest("That vehicle is not on this customer's profile.");
            vehicle = { vehicleId: owned.id, vehicleModel: owned.model, vehicleNumber: owned.number };
          } else {
            const typed = prepareVehicle({ number: input.proof.vehicleNumber ?? '', model: input.proof.vehicleModel });
            vehicle = { vehicleId: null, vehicleModel: typed.model, vehicleNumber: typed.number };
          }
        }

        const { customer, transaction, unlockedRewards } = await creditPoints(tx, {
          customerId: input.customerId,
          points,
          label: `Fuel purchase: ${points} ltr`,
          source: 'FUEL_ENTRY',
          fuelAmountRupees: amountRupees,
          staffId: input.staffId,
        });

        let proof: Awaited<ReturnType<typeof FuelClaimModel.createVerified>> | null = null;
        if (input.proof && saved && vehicle) {
          proof = await FuelClaimModel.createVerified(tx, {
            id: saved.id,
            customerId: input.customerId,
            ...vehicle,
            claimedAmountRupees: amountRupees,
            latitude: input.proof.latitude,
            longitude: input.proof.longitude,
            accuracy: input.proof.accuracy ?? null,
            photoPath: saved.path,
            photoMime: saved.mime,
            resolvedById: input.staffId,
            pointsAwarded: points,
          });
        }

        return { customer, transaction, amountRupees, litres: points, pointsEarned: points, unlockedRewards, proof };
      });
    } catch (error) {
      if (saved) await removeUpload(saved.path); // nothing was recorded, so do not keep an orphaned photo
      throw error;
    }
  },
};
