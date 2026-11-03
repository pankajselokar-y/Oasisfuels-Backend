import { readFile } from 'node:fs/promises';
import type { RequestHandler } from 'express';
import { notFound } from '../utils/AppError.js';
import { FuelClaimService } from '../services/fuelClaim.service.js';
import { authOf, created, ok, queryOf } from '../utils/http.js';
import { pageMeta, type Pagination } from '../utils/pagination.js';
import { fuelClaimDto } from '../utils/serializers.js';
import type { ReviewStatus } from '../generated/prisma/client.js';

export const mine: RequestHandler = async (req, res) => {
  ok(res, (await FuelClaimService.listForCustomer(authOf(req).sub)).map(fuelClaimDto));
};

export const list: RequestHandler = async (req, res) => {
  const query = queryOf<Pagination & { status?: ReviewStatus }>(req);
  const { claims, total } = await FuelClaimService.list(query.status, query);
  ok(res, claims.map(fuelClaimDto), pageMeta(query, total));
};

export const get: RequestHandler = async (req, res) => {
  const auth = authOf(req);
  ok(res, fuelClaimDto(await FuelClaimService.getForViewer(req.params['id'] as string, { id: auth.sub, role: auth.role })));
};

export const photo: RequestHandler = async (req, res) => {
  const auth = authOf(req);
  const { absolutePath, mime } = await FuelClaimService.photoFor(req.params['id'] as string, {
    id: auth.sub,
    role: auth.role,
  });
  // A proof whose file has gone missing (e.g. uploads were not on a persistent disk) is a clean 404, not a server error.
  let image: Buffer;
  try {
    image = await readFile(absolutePath);
  } catch {
    throw notFound('This photo is no longer available.');
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // ?as=dataUri lets the mobile app show the photo without handling binary responses.
  if (req.query['as'] === 'dataUri') return ok(res, { dataUri: `data:${mime};base64,${image.toString('base64')}` });
  res.type(mime).send(image);
};

export const approve: RequestHandler = async (req, res) => {
  const claim = await FuelClaimService.approve(req.params['id'] as string, authOf(req).sub, req.body.amountRupees);
  ok(res, fuelClaimDto(claim!));
};

export const reject: RequestHandler = async (req, res) => {
  const claim = await FuelClaimService.reject(req.params['id'] as string, authOf(req).sub, req.body.reason);
  ok(res, fuelClaimDto(claim!));
};
