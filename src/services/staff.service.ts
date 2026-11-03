import { prisma } from '../lib/prisma.js';
import { hashSecret, verifySecret } from '../lib/password.js';
import type { StaffRole } from '../generated/prisma/client.js';
import { StaffModel } from '../models/staff.model.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/prismaErrors.js';

const USERNAME_TAKEN = 'That username is already taken.';

export const StaffService = {
  list: () => StaffModel.list(prisma),

  async get(id: string) {
    const staff = await StaffModel.findById(prisma, id);
    if (!staff) throw notFound('Staff account not found.');
    return staff;
  },

  async create(input: { name: string; username: string; password: string; role: StaffRole }) {
    try {
      return await StaffModel.create(prisma, {
        name: input.name.trim(),
        username: input.username,
        passwordHash: await hashSecret(input.password),
        role: input.role,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(USERNAME_TAKEN);
      throw error;
    }
  },

  /** Admin edit: name and username always; the password only when a new one is supplied. */
  async update(id: string, input: { name?: string; username?: string; password?: string }) {
    if (!(await StaffModel.findById(prisma, id))) throw notFound('Staff account not found.');
    try {
      return await StaffModel.update(prisma, id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.username !== undefined ? { username: input.username.toLowerCase() } : {}),
        ...(input.password ? { passwordHash: await hashSecret(input.password) } : {}),
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(USERNAME_TAKEN);
      throw error;
    }
  },

  async setActive(id: string, active: boolean, actingStaffId: string) {
    const target = await StaffModel.findById(prisma, id);
    if (!target) throw notFound('Staff account not found.');

    if (!active) {
      if (id === actingStaffId) throw badRequest('You cannot disable your own account.');
      if (target.role === 'ADMIN' && (await StaffModel.countActiveAdmins(prisma, id)) === 0) {
        throw badRequest('At least one active admin is required.');
      }
    }
    return StaffModel.update(prisma, id, { active });
  },

  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const staff = await StaffModel.findById(prisma, id);
    if (!staff) throw notFound('Staff account not found.');
    if (!(await verifySecret(currentPassword, staff.passwordHash))) throw badRequest('Current password is incorrect.');
    await StaffModel.update(prisma, id, { passwordHash: await hashSecret(newPassword) });
  },
};
