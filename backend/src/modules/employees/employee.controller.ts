import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import type {
  CreateEmployeeBody,
  EmployeeIdParams,
  ExportEmployeesQuery,
  ListEmployeesQuery,
  UpdateEmployeeBody,
} from './employee.schema.js';
import type { EmployeesService } from './employee.service.js';
import type { EmployeeFilters } from './employee.types.js';

function toFilters(query: ExportEmployeesQuery): EmployeeFilters {
  return {
    q: query.q,
    country: query.country,
    departmentId: query.department,
    level: query.level,
    status: query.status,
  };
}

export function createEmployeeController(service: EmployeesService) {
  return {
    async list(req: Request, res: Response) {
      const query = req.query as unknown as ListEmployeesQuery;
      res.json(
        await service.list({
          filters: toFilters(query),
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        }),
      );
    },

    async exportCsv(req: Request, res: Response) {
      const query = req.query as unknown as ExportEmployeesQuery;
      const filename = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      // pipeline handles backpressure and tears down the response if a batch query fails.
      await pipeline(Readable.from(service.exportCsv(toFilters(query), query.sort)), res);
    },

    async getById(req: Request, res: Response) {
      const { id } = req.params as unknown as EmployeeIdParams;
      res.json(await service.getById(id));
    },

    async create(req: Request, res: Response) {
      const employee = await service.create(req.body as CreateEmployeeBody);
      res.status(201).location(`/api/employees/${employee.id}`).json(employee);
    },

    async update(req: Request, res: Response) {
      const { id } = req.params as unknown as EmployeeIdParams;
      res.json(await service.update(id, req.body as UpdateEmployeeBody));
    },
  };
}
