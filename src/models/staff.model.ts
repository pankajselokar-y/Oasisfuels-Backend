import type { Db } from '../lib/prisma.js';
import { Prisma, type StaffRole } from '../generated/prisma/client.js';

export const StaffModel = {
  findById: (db: Db, id: string) => db.staff.findUnique({ where: { id } }),

  findByUsername: (db: Db, username: string) => db.staff.findUnique({ where: { username: username.toLowerCase() } }),

  list: (db: Db) => db.staff.findMany({ orderBy: { name: 'asc' } }),

  create: (db: Db, data: { name: string; username: string; passwordHash: string; role: StaffRole }) =>
    db.staff.create({ data: { ...data, username: data.username.toLowerCase() } }),

  update: (db: Db, id: string, data: Prisma.StaffUpdateInput) => db.staff.update({ where: { id }, data }),

  countActiveAdmins: (db: Db, excludingId?: string) =>
    db.staff.count({ where: { role: 'ADMIN', active: true, ...(excludingId ? { id: { not: excludingId } } : {}) } }),
};
