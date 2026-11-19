import type { Setting } from '../generated/prisma/client.js';
import { badRequest } from './AppError.js';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line distance in metres between two GPS points (haversine). */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const readable = (metres: number) => (metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`);

/**
 * Photos (fuel proofs, gift handovers) are only accepted when taken at the pump. Once an admin has set the pump's location,
 * the position the phone reports must be within the allowed radius of it, and accurate enough to be believed. Until the
 * location is set nothing is checked, so a new installation works straight away.
 */
export function assertAtPump(
  settings: Pick<Setting, 'pumpLatitude' | 'pumpLongitude' | 'geofenceMeters'>,
  spot: { latitude: number; longitude: number; accuracy?: number | null },
): void {
  if (settings.pumpLatitude == null || settings.pumpLongitude == null) return;
  const radius = settings.geofenceMeters;
  const distance = distanceMeters(spot, { latitude: settings.pumpLatitude, longitude: settings.pumpLongitude });
  if (distance > radius) {
    throw badRequest(`You are about ${readable(distance)} from the pump. Photos can only be taken within ${radius} m of the pump.`);
  }
  if (spot.accuracy != null && spot.accuracy > radius) {
    throw badRequest(
      `The GPS signal is too weak (accurate to only ${readable(spot.accuracy)}) to confirm you are at the pump. Move to open sky and try again.`,
    );
  }
}
