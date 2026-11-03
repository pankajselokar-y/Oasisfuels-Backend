import { Router } from 'express';
import * as customers from '../controllers/customer.controller.js';
import { authenticate, staffOnly } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import { createCustomerBody, historyQuery, listCustomersQuery } from '../validators/customer.validator.js';

/** Customer management — cashiers and admins. */
export const customerRoutes = Router();

customerRoutes.use(authenticate, staffOnly);

customerRoutes.get('/', validate({ query: listCustomersQuery }), customers.list);
customerRoutes.post('/', validate({ body: createCustomerBody }), customers.create);
customerRoutes.get('/:id', validate({ params: idParam }), customers.get);
customerRoutes.get('/:id/history', validate({ params: idParam, query: historyQuery }), customers.history);
