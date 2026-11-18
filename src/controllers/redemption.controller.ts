import type { RequestHandler } from 'express';
import type { ReviewStatus } from '../generated/prisma/client.js';
import { RedemptionService } from '../services/redemption.service.js';
import { notFound } from '../utils/AppError.js';
import { authOf, created, ok, queryOf } from '../utils/http.js';
import { decodePhotoDataUri } from '../utils/photo.js';
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

export const issue: RequestHandler = async (req, res) => {
  const { photoDataUri, latitude, longitude, accuracy } = req.body;
  const request = await RedemptionService.issue(req.params['id'] as string, authOf(req).sub, {
    photo: decodePhotoDataUri(photoDataUri),
    latitude,
    longitude,
    accuracy,
  });
  ok(res, redemptionDto(request!));
};

export const cancel: RequestHandler = async (req, res) => {
  ok(res, redemptionDto((await RedemptionService.cancel(req.params['id'] as string, authOf(req).sub))!));
};

export const reject: RequestHandler = async (req, res) => {
  ok(res, redemptionDto((await RedemptionService.reject(req.params['id'] as string, authOf(req).sub, req.body.reason))!));
};

export const photo: RequestHandler = async (req, res) => {
  const auth = authOf(req);
  const found = await RedemptionService.photoFor(req.params['id'] as string, { id: auth.sub, role: auth.role });
  if (!found) throw notFound('There is no handover photo for this request.');
  const { image, mime } = found;
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // ?as=dataUri lets the mobile app show the photo without handling binary responses.
  if (req.query['as'] === 'dataUri') return ok(res, { dataUri: `data:${mime};base64,${image.toString('base64')}` });
  res.type(mime).send(image);
};
