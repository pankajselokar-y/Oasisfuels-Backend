import type { RequestHandler } from 'express';
import { ReportService } from '../services/report.service.js';
import { RewardService } from '../services/reward.service.js';
import { SettingService } from '../services/setting.service.js';
import { StaffService } from '../services/staff.service.js';
import { authOf, created, ok, queryOf } from '../utils/http.js';
import { pageMeta, toSkipTake, type Pagination } from '../utils/pagination.js';
import { inactiveVehicleDto, redemptionDto, rewardDto, settingsDto, staffDto } from '../utils/serializers.js';

// --- Staff accounts (admin) -------------------------------------------------------------

export const listStaff: RequestHandler = async (_req, res) => {
  ok(res, (await StaffService.list()).map(staffDto));
};

export const createStaff: RequestHandler = async (req, res) => {
  created(res, staffDto(await StaffService.create(req.body)));
};

export const updateStaff: RequestHandler = async (req, res) => {
  ok(res, staffDto(await StaffService.update(req.params['id'] as string, req.body)));
};

export const setStaffActive: RequestHandler = async (req, res) => {
  ok(res, staffDto(await StaffService.setActive(req.params['id'] as string, req.body.active, authOf(req).sub)));
};

/** Any signed-in staff member can change their own password. */
export const changeOwnPassword: RequestHandler = async (req, res) => {
  await StaffService.changeOwnPassword(authOf(req).sub, req.body.currentPassword, req.body.newPassword);
  ok(res, { changed: true });
};

// --- Reports (admin) --------------------------------------------------------------------

export const issuedItems: RequestHandler = async (req, res) => {
  const { days, from, to } = queryOf<{ days: number | 'all'; from?: Date; to?: Date }>(req);
  const report = await ReportService.issuedItems({ days: days === 'all' ? null : days, from, to });
  ok(res, { ...report, items: report.items.map(redemptionDto) });
};

export const inactiveVehicles: RequestHandler = async (req, res) => {
  const query = queryOf<Pagination & { days: number }>(req);
  const { skip, take } = toSkipTake(query);
  const report = await ReportService.inactiveVehicles(query.days, skip, take);
  ok(res, report.items.map(inactiveVehicleDto), { ...pageMeta(query, report.total), days: report.days });
};

export const dashboard: RequestHandler = async (_req, res) => {
  ok(res, await ReportService.dashboard());
};

// --- Program rules ----------------------------------------------------------------------

export const getSettings: RequestHandler = async (_req, res) => {
  ok(res, settingsDto(await SettingService.get()));
};

export const updateSettings: RequestHandler = async (req, res) => {
  ok(res, settingsDto(await SettingService.update(req.body)));
};

export const listRewards: RequestHandler = async (_req, res) => {
  ok(res, (await RewardService.listActive()).map(rewardDto));
};
