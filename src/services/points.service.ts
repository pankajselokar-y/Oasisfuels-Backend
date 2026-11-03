import type { Db } from '../lib/prisma.js';
import type { TransactionSource } from '../generated/prisma/client.js';
import { CustomerModel } from '../models/customer.model.js';
import { RewardModel } from '../models/reward.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { conflict } from '../utils/AppError.js';

/**
 * The only place balances change. Always call these inside a `prisma.$transaction` so the
 * balance change and its ledger row commit (or roll back) together.
 */

export async function creditPoints(
  db: Db,
  input: {
    customerId: string;
    points: number;
    label: string;
    source: TransactionSource;
    fuelAmountRupees?: number;
    staffId?: string;
  },
) {
  const customer = await CustomerModel.credit(db, input.customerId, input.points);
  const transaction = await TransactionModel.create(db, {
    customerId: input.customerId,
    type: 'EARN',
    source: input.source,
    label: input.label,
    amount: input.points,
    fuelAmountRupees: input.fuelAmountRupees ?? null,
    performedById: input.staffId ?? null,
  });
  const previousPoints = customer.points - input.points;
  const unlockedRewards = await RewardModel.crossed(db, previousPoints, customer.points);
  return { customer, transaction, previousPoints, unlockedRewards };
}

export async function debitPoints(
  db: Db,
  input: { customerId: string; points: number; label: string; source: TransactionSource; staffId?: string },
) {
  const ok = await CustomerModel.debit(db, input.customerId, input.points);
  if (!ok) throw conflict('The customer no longer has enough points for this reward.');
  return TransactionModel.create(db, {
    customerId: input.customerId,
    type: 'REDEEM',
    source: input.source,
    label: input.label,
    amount: input.points,
    performedById: input.staffId ?? null,
  });
}
