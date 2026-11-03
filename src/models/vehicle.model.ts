import type { Db } from '../lib/prisma.js';

export const VehicleModel = {
  listByCustomer: (db: Db, customerId: string) =>
    db.vehicle.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),

  findOwned: (db: Db, customerId: string, vehicleId: string) =>
    db.vehicle.findFirst({ where: { id: vehicleId, customerId } }),

  create: (db: Db, customerId: string, data: { model: string; number: string; numberKey: string }) =>
    db.vehicle.create({ data: { customerId, ...data } }),

  update: (db: Db, id: string, data: { model: string; number: string; numberKey: string }) =>
    db.vehicle.update({ where: { id }, data }),

  remove: (db: Db, id: string) => db.vehicle.delete({ where: { id } }),
};
