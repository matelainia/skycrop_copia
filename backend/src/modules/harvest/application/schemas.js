import { z } from 'zod';

export const createHarvestSchema = z.object({
  predio_id: z.string().uuid().nullable().optional(),
  lote_agricola_id: z.string().uuid().nullable().optional().or(z.literal('')),
  cultivo: z.string().min(1, 'Cultivo requerido').max(100),
  variedad: z.string().max(100).nullable().optional(),
  area_cosechada: z.coerce.number().min(0.01, 'Área debe ser >0').max(10000).nullable().optional(),
  cantidad: z.coerce.number().min(0.1, 'Cantidad debe ser >0').max(1000000),
  unidad: z.string().default('kg').optional(),
  numero_plantas: z.coerce.number().int().min(0).nullable().optional(),
  responsable: z.string().max(150).nullable().optional(),
  observaciones: z.string().max(2000).nullable().optional(),
  latitud: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitud: z.coerce.number().min(-180).max(180).nullable().optional(),
  precision_gps: z.coerce.number().min(0).nullable().optional()
});

export const updateHarvestSchema = createHarvestSchema.partial().extend({
  estado: z.enum(['BORRADOR', 'REGISTRADA', 'EN_POSTCOSECHA', 'FINALIZADA', 'ANULADA']).optional()
});

export const listHarvestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  predio_id: z.string().uuid().nullable().optional(),
  lote_id: z.string().uuid().nullable().optional(),
  cultivo: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  periodo: z
    .enum(['este_anio', 'ultimos_6_meses', 'este_mes', 'todos'])
    .default('este_anio')
    .optional(),
  search: z.string().max(100).nullable().optional()
});

export const dashboardFiltersSchema = z.object({
  predio_id: z.string().uuid().nullable().optional(),
  lote_id: z.string().uuid().nullable().optional(),
  periodo: z
    .enum(['este_anio', 'ultimos_6_meses', 'este_mes', 'todos'])
    .default('este_anio')
    .optional(),
  cultivo: z.string().nullable().optional()
});
