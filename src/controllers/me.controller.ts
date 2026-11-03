import type { RequestHandler } from 'express';
import { CustomerService } from '../services/customer.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { authOf, created, ok, queryOf } from '../utils/http.js';
import { pageMeta, type Pagination } from '../utils/pagination.js';
import { customerDto, transactionDto, vehicleDto } from '../utils/serializers.js';

/** Endpoints for the signed-in customer's own account. */

export const getProfile: RequestHandler = async (req, res) => {
  const { customer, stats } = await CustomerService.profile(authOf(req).sub);
  ok(res, { ...customerDto(customer), stats });
};

export const updateProfile: RequestHandler = async (req, res) => {
  ok(res, customerDto(await CustomerService.updateName(authOf(req).sub, req.body.name)));
};

export const changePin: RequestHandler = async (req, res) => {
  await CustomerService.changePin(authOf(req).sub, req.body.currentPin, req.body.newPin);
  ok(res, { changed: true });
};

export const history: RequestHandler = async (req, res) => {
  const pagination = queryOf<Pagination>(req);
  const { transactions, total } = await CustomerService.history(authOf(req).sub, pagination);
  ok(res, transactions.map(transactionDto), pageMeta(pagination, total));
};

export const listVehicles: RequestHandler = async (req, res) => {
  ok(res, (await VehicleService.list(authOf(req).sub)).map(vehicleDto));
};

export const addVehicle: RequestHandler = async (req, res) => {
  created(res, vehicleDto(await VehicleService.add(authOf(req).sub, req.body)));
};

export const updateVehicle: RequestHandler = async (req, res) => {
  const vehicleId = req.params['vehicleId'] as string;
  ok(res, vehicleDto(await VehicleService.update(authOf(req).sub, vehicleId, req.body)));
};

export const removeVehicle: RequestHandler = async (req, res) => {
  await VehicleService.remove(authOf(req).sub, req.params['vehicleId'] as string);
  res.status(204).end();
};
