import { readFile } from 'node:fs/promises';
import type { RequestHandler } from 'express';
import { MAX_PHOTO_BYTES } from '../config/constants.js';
import { badRequest } from '../utils/AppError.js';
import { FuelClaimService } from '../services/fuelClaim.service.js';
import { authOf, created, ok, queryOf } from '../utils/http.js';
import { pageMeta, type Pagination } from '../utils/pagination.js';
import { fuelClaimDto } from '../utils/serializers.js';
import type { ReviewStatus } from '../generated/prisma/client.js';

/** The photo is either an uploaded file (multipart) or a base64 data URI in the JSON body. */
function photoFrom(req: Parameters<RequestHandler>[0]): { buffer: Buffer } | undefined {
  if (req.file) return { buffer: req.file.buffer };
  const dataUri: string | undefined = req.body.photoDataUri;
  if (!dataUri) return undefined;
  const buffer = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) throw badRequest('The photo is too large (max 5 MB).');
  return { buffer };
}

export const submit: RequestHandler = async (req, res) => {
  const { photoDataUri: _ignored, ...fields } = req.body;
  const claim = await FuelClaimService.submit({
    ...fields,
    customerId: authOf(req).sub,
    photo: photoFrom(req),
  });
  created(res, fuelClaimDto(claim));
};

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
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // ?as=dataUri lets the mobile app show the photo without handling binary responses.
  if (req.query['as'] === 'dataUri') {
    return ok(res, { dataUri: `data:${mime};base64,${(await readFile(absolutePath)).toString('base64')}` });
  }
  res.type(mime).sendFile(absolutePath);
};

export const approve: RequestHandler = async (req, res) => {
  const claim = await FuelClaimService.approve(req.params['id'] as string, authOf(req).sub, req.body.amountRupees);
  ok(res, fuelClaimDto(claim!));
};

export const reject: RequestHandler = async (req, res) => {
  const claim = await FuelClaimService.reject(req.params['id'] as string, authOf(req).sub, req.body.reason);
  ok(res, fuelClaimDto(claim!));
};
