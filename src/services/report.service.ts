import { INACTIVE_VEHICLE_DAYS, ISSUE_LOG_DEFAULT_DAYS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { CustomerModel } from '../models/customer.model.js';
import { FuelClaimModel } from '../models/fuelClaim.model.js';
import { RedemptionModel } from '../models/redemption.model.js';
import { TransactionModel } from '../models/transaction.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InactiveVehicleRow {
  vehicleId: string;
  number: string;
  model: string;
  addedAt: Date;
  lastFillAt: Date | null;
  /** The date the quiet period is counted from: the last fill, or the day the vehicle was added if it never filled. */
  since: Date;
  customerId: string;
  customerName: string;
  customerPhone: string;
}

// A vehicle's last fill is its latest APPROVED fuel proof. A proof belongs to a vehicle either by id (a saved vehicle) or by
// plate number (a plate the cashier typed in), so both are matched.
const LAST_FILL_PER_VEHICLE = `
  SELECT v.id AS vehicle_id, MAX(fc."submittedAt") AS last_fill
  FROM "Vehicle" v
  JOIN "FuelClaim" fc
    ON fc."customerId" = v."customerId"
   AND (fc."vehicleId" = v.id OR upper(replace(fc."vehicleNumber", ' ', '')) = upper(v."numberKey"))
  WHERE fc.status = 'APPROVED'
  GROUP BY v.id
`;

export const ReportService = {
  /**
   * Rewards handed over to customers. Nothing is ever purged, so any window — including the
   * default 45 days — can be answered. `days` of null means all time.
   */
  async issuedItems(window: { days: number | null; from?: Date; to?: Date }) {
    // An explicit from/to range wins over "last N days".
    const custom = Boolean(window.from || window.to);
    const since = custom ? (window.from ?? null) : window.days ? new Date(Date.now() - window.days * DAY_MS) : null;
    const until = custom ? (window.to ?? null) : null;
    const items = await RedemptionModel.listIssued(prisma, since, until);

    const byItem = new Map<string, { rewardId: string; name: string; icon: string; count: number }>();
    for (const item of items) {
      const entry = byItem.get(item.rewardId) ?? {
        rewardId: item.rewardId,
        name: item.rewardName,
        icon: item.rewardIcon,
        count: 0,
      };
      entry.count += 1;
      byItem.set(item.rewardId, entry);
    }

    return {
      periodDays: custom ? null : window.days,
      from: since,
      to: until,
      summary: {
        totalItems: items.length,
        totalPoints: items.reduce((sum, i) => sum + i.points, 0),
        customerCount: new Set(items.map((i) => i.customerId)).size,
      },
      byItem: [...byItem.values()].sort((a, b) => b.count - a.count),
      items,
    };
  },

  /**
   * Vehicles with no fuel fill for more than `days` days, longest-quiet first, so the admin can contact those customers.
   * A vehicle that never filled is counted from the day it was added, so a brand-new vehicle is not flagged.
   */
  async inactiveVehicles(days: number, skip: number, take: number) {
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const [rows, total] = await Promise.all([
      prisma.$queryRawUnsafe<InactiveVehicleRow[]>(
        `WITH last_fill AS (${LAST_FILL_PER_VEHICLE})
         SELECT v.id AS "vehicleId", v.number, v.model, v."createdAt" AS "addedAt", lf.last_fill AS "lastFillAt",
                COALESCE(lf.last_fill, v."createdAt") AS since,
                c.id AS "customerId", c.name AS "customerName", c.phone AS "customerPhone"
         FROM "Vehicle" v
         JOIN "Customer" c ON c.id = v."customerId"
         LEFT JOIN last_fill lf ON lf.vehicle_id = v.id
         WHERE COALESCE(lf.last_fill, v."createdAt") < $1
         ORDER BY since ASC, v.id ASC
         LIMIT $2 OFFSET $3`,
        cutoff,
        take,
        skip,
      ),
      ReportService.inactiveVehicleCount(days),
    ]);
    const now = Date.now();
    return {
      days,
      total,
      items: rows.map((row) => ({ ...row, daysInactive: Math.floor((now - new Date(row.since).getTime()) / DAY_MS) })),
    };
  },

  async inactiveVehicleCount(days: number = INACTIVE_VEHICLE_DAYS): Promise<number> {
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `WITH last_fill AS (${LAST_FILL_PER_VEHICLE})
       SELECT COUNT(*) AS count
       FROM "Vehicle" v
       LEFT JOIN last_fill lf ON lf.vehicle_id = v.id
       WHERE COALESCE(lf.last_fill, v."createdAt") < $1`,
      cutoff,
    );
    return Number(rows[0]?.count ?? 0);
  },

  /** The admin dashboard's headline numbers. */
  async dashboard() {
    const since = new Date(Date.now() - ISSUE_LOG_DEFAULT_DAYS * DAY_MS);
    const [totals, pendingRedemptions, pendingFuelClaims, pointsRedeemed, issuedRecently, inactiveVehicles] = await Promise.all([
      CustomerModel.totals(prisma),
      RedemptionModel.count(prisma, 'PENDING'),
      FuelClaimModel.count(prisma, 'PENDING'),
      TransactionModel.totalRedeemed(prisma),
      RedemptionModel.countIssued(prisma, since),
      ReportService.inactiveVehicleCount(),
    ]);
    return {
      ...totals,
      pendingRedemptions,
      pendingFuelClaims,
      pointsRedeemed,
      itemsIssuedLast45Days: issuedRecently,
      inactiveVehicles,
      inactiveVehicleDays: INACTIVE_VEHICLE_DAYS,
    };
  },
};
