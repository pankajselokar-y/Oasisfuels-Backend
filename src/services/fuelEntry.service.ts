import { randomUUID } from 'node:crypto';
import { ALLOWED_PHOTO_TYPES } from '../config/constants.js';
import { logger } from '../lib/logger.js';
import { stampJpeg } from '../lib/photoStamp.js';
import { prisma } from '../lib/prisma.js';
import { detectImageType } from '../lib/storage.js';
import { CustomerModel } from '../models/customer.model.js';
import { FuelClaimModel } from '../models/fuelClaim.model.js';
import { SettingModel } from '../models/setting.model.js';
import { VehicleModel } from '../models/vehicle.model.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { pointsForAmount } from '../utils/fuel.js';
import { creditPoints } from './points.service.js';
import { prepareVehicle } from './vehicle.service.js';

const log = logger('fuel-entry');

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
    // The photo is checked and stamped before the transaction starts, which keeps the transaction short. It is then stored
    // in the claim row itself, so nothing is written to disk (hosts like Vercel have no persistent disk).
    let saved: { id: string; photo: Buffer; mime: string } | null = null;
    if (input.proof) {
      const mime = detectImageType(input.proof.photo);
      if (!mime || !(ALLOWED_PHOTO_TYPES as readonly string[]).includes(mime)) {
        throw badRequest('The photo must be a JPEG, PNG or WebP image.');
      }
      const id = randomUUID();
      // The proof photo carries its own geo-tag: date and time (server clock, India time), GPS position and accuracy.
      // If a photo cannot be stamped (not a JPEG, or unreadable) it is kept as it was, so that never blocks a fuel entry.
      let photo = input.proof.photo;
      if (mime === 'image/jpeg') {
        try {
          photo = stampJpeg(photo, {
            latitude: input.proof.latitude,
            longitude: input.proof.longitude,
            accuracy: input.proof.accuracy,
            at: new Date(),
          });
        } catch (error) {
          log.warn(`could not stamp the proof photo, keeping the original: ${error instanceof Error ? error.message : error}`);
        }
      }
      saved = { id, photo, mime };
    }

    return prisma.$transaction(async (tx) => {
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
          photo: saved.photo,
          photoMime: saved.mime,
          resolvedById: input.staffId,
          pointsAwarded: points,
        });
      }

      return { customer, transaction, amountRupees, litres: points, pointsEarned: points, unlockedRewards, proof };
    });
  },
};
