import { Router } from 'express';
import { validate } from '../../shared/middleware/index.js';
import { createEmployeeController } from './employee.controller.js';
import {
  CreateEmployeeBody,
  EmployeeIdParams,
  ExportEmployeesQuery,
  ListEmployeesQuery,
  UpdateEmployeeBody,
} from './employee.schema.js';
import type { EmployeesService } from './employee.service.js';

export function employeeRoutes(service: EmployeesService): Router {
  const controller = createEmployeeController(service);
  const router = Router();

  router.get('/', validate({ query: ListEmployeesQuery }), controller.list);
  // Registered before "/:id" so "export" is not treated as an id.
  router.get('/export', validate({ query: ExportEmployeesQuery }), controller.exportCsv);
  router.get('/:id', validate({ params: EmployeeIdParams }), controller.getById);
  router.post('/', validate({ body: CreateEmployeeBody }), controller.create);
  router.patch(
    '/:id',
    validate({ params: EmployeeIdParams, body: UpdateEmployeeBody }),
    controller.update,
  );

  return router;
}
