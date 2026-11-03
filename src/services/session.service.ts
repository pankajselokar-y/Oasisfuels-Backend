import { createHash, randomBytes } from 'node:crypto';
import { REFRESH_TOKEN_DAYS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { signToken, type Role } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { CustomerModel } from '../models/customer.model.js';
import { StaffModel } from '../models/staff.model.js';
import { unauthorized } from '../utils/AppError.js';

const log = logger('session');
const DAY_MS = 24 * 60 * 60 * 1000;
/** A just-rotated token presented again within this window is treated as a retry, not a theft. */
const REUSE_GRACE_MS = 30 * 1000;
const EXPIRED = 'Your session has expired. Please sign in again.';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface Subject {
  id: string;
  role: Role;
}

export interface Tokens {
  /** Short-lived JWT sent with every request. */
  token: string;
  /** Long-lived and single-use; swapped for a new pair via POST /auth/refresh. */
  refreshToken: string;
}

export const SessionService = {
  /** Starts a session for a freshly authenticated customer or staff member. */
  async start(subject: Subject): Promise<Tokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        subjectId: subject.id,
        isStaff: subject.role !== 'CUSTOMER',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * DAY_MS),
      },
    });
    // Housekeeping: dead sessions are only useful briefly (for reuse detection), so clear out old ones.
    void prisma.refreshToken
      .deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * DAY_MS) } }] },
      })
      .catch(() => undefined);
    return { token: signToken({ sub: subject.id, role: subject.role }), refreshToken };
  },

  /**
   * Swaps a refresh token for a new access + refresh pair. The old refresh token stops working. Presenting one that
   * was already used (outside a short retry window) means it may have been stolen, so every session of that account ends.
   */
  async refresh(refreshToken: string): Promise<Tokens & { role: Role }> {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!row) throw unauthorized(EXPIRED);

    if (row.revokedAt) {
      if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.revokeAll(row.subjectId);
        log.warn(`refresh token reuse detected for ${row.isStaff ? 'staff' : 'customer'} ${row.subjectId}; all sessions revoked`);
      }
      throw unauthorized(EXPIRED);
    }
    if (row.expiresAt.getTime() <= Date.now()) throw unauthorized(EXPIRED);

    // The account must still be allowed in: a deleted customer or a disabled staff member cannot refresh.
    let role: Role;
    if (row.isStaff) {
      const staff = await StaffModel.findById(prisma, row.subjectId);
      if (!staff || !staff.active) throw unauthorized(EXPIRED);
      role = staff.role;
    } else {
      if (!(await CustomerModel.findById(prisma, row.subjectId))) throw unauthorized(EXPIRED);
      role = 'CUSTOMER';
    }

    // Single use: only one caller can win the revoke, so two racing refreshes cannot both mint a session.
    const revoked = await prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw unauthorized(EXPIRED);

    return { ...(await this.start({ id: row.subjectId, role })), role };
  },

  /** Sign out of one device. Unknown or already-revoked tokens are ignored. */
  async end(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  /** Sign an account out everywhere (PIN reset, password change, staff disabled). */
  async revokeAll(subjectId: string): Promise<void> {
    await prisma.refreshToken.updateMany({ where: { subjectId, revokedAt: null }, data: { revokedAt: new Date() } });
  },
};
