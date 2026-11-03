import type { RequestHandler } from 'express';
import type { ReviewStatus } from '../generated/prisma/client.js';
import { RedemptionService } from '../services/redemption.service.js';
import { authOf, created, ok, queryOf } from '../utils/http.js';
import { pageMeta, type Pagination } from '../utils/pagination.js';
import { redemptionDto } from '../utils/serializers.js';

export const request: RequestHandler = async (req, res) => {
  created(res, redemptionDto(await RedemptionService.request(authOf(req).sub, req.body.rewardId)));
};

export const mine: RequestHandler = async (req, res) => {
  ok(res, (await RedemptionService.listForCustomer(authOf(req).sub)).map(redemptionDto));
};

export const list: RequestHandler = async (req, res) => {
  const query = queryOf<Pagination & { status?: ReviewStatus }>(req);
  const { requests, total } = await RedemptionService.list(query.status, query);
  ok(res, requests.map(redemptionDto), pageMeta(query, total));
};

export const approve: RequestHandler = async (req, res) => {
  ok(res, redemptionDto((await RedemptionService.approve(req.params['id'] as string, authOf(req).sub))!));
};

export const reject: RequestHandler = async (req, res) => {
  ok(res, redemptionDto((await RedemptionService.reject(req.params['id'] as string, authOf(req).sub))!));
};
