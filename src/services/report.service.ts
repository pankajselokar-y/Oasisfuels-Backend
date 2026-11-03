import { ISSUE_LOG_DEFAULT_DAYS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { CustomerModel } from '../models/customer.model.js';
import { FuelClaimModel } from '../models/fuelClaim.model.js';
import { RedemptionModel } from '../models/redemption.model.js';
import { TransactionModel } from '../models/transaction.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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

  /** The admin dashboard's headline numbers. */
  async dashboard() {
    const since = new Date(Date.now() - ISSUE_LOG_DEFAULT_DAYS * DAY_MS);
    const [totals, pendingRedemptions, pendingFuelClaims, pointsRedeemed, issuedRecently] = await Promise.all([
      CustomerModel.totals(prisma),
      RedemptionModel.count(prisma, 'PENDING'),
      FuelClaimModel.count(prisma, 'PENDING'),
      TransactionModel.totalRedeemed(prisma),
      RedemptionModel.countIssued(prisma, since),
    ]);
    return {
      ...totals,
      pendingRedemptions,
      pendingFuelClaims,
      pointsRedeemed,
      itemsIssuedLast45Days: issuedRecently,
    };
  },
};
