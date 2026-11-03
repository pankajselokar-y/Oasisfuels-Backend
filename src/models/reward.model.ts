import type { Db } from '../lib/prisma.js';

export const RewardModel = {
  listActive: (db: Db) => db.reward.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { points: 'asc' }] }),

  findById: (db: Db, id: string) => db.reward.findUnique({ where: { id } }),

  /** Rewards a customer newly qualifies for when their balance moves from `from` up to `to`. */
  crossed: (db: Db, from: number, to: number) =>
    db.reward.findMany({
      where: { active: true, points: { gt: from, lte: to } },
      orderBy: { points: 'asc' },
    }),
};
