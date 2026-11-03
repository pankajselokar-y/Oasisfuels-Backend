import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { CustomerService } from '../services/customer.service.js';
import { created, ok, queryOf } from '../utils/http.js';
import { pageMeta, type Pagination } from '../utils/pagination.js';
import { customerDto, transactionDto } from '../utils/serializers.js';

/** Customer management for cashiers and admins. */

export const list: RequestHandler = async (req, res) => {
  const query = queryOf<Pagination & { search?: string }>(req);
  const { customers, total } = await CustomerService.list(query.search, query);
  ok(res, customers.map(customerDto), pageMeta(query, total));
};

export const create: RequestHandler = async (req, res) => {
  const customer = await CustomerService.createAccount({ ...req.body, pin: req.body.pin ?? env.DEFAULT_CUSTOMER_PIN });
  created(res, customerDto(customer));
};

export const get: RequestHandler = async (req, res) => {
  const { customer, stats } = await CustomerService.profile(req.params['id'] as string);
  ok(res, { ...customerDto(customer), stats });
};

export const history: RequestHandler = async (req, res) => {
  const pagination = queryOf<Pagination>(req);
  const { transactions, total } = await CustomerService.history(req.params['id'] as string, pagination);
  ok(res, transactions.map(transactionDto), pageMeta(pagination, total));
};
