import { z } from 'zod';
import {
  TRACE_EVENT_TYPES,
  TRACE_SOURCE_MODULES,
  TRACE_ESTADOS
} from '../domain/traceability.constants.js';

const uuid = z.string().uuid();

export const listEventsSchema = z.object({
  lote_id: uuid.nullable().optional(),
  lot_id: uuid.nullable().optional(),
  predio_id: uuid.nullable().optional(),
  farm_id: uuid.nullable().optional(),
  event_type: z.enum(TRACE_EVENT_TYPES).nullable().optional(),
  tipo: z.string().nullable().optional(),
  source_module: z.enum(TRACE_SOURCE_MODULES).nullable().optional(),
  modulo: z.string().nullable().optional(),
  responsable: z.string().max(150).nullable().optional(),
  desde: z.string().nullable().optional(),
  hasta: z.string().nullable().optional(),
  fecha_desde: z.string().nullable().optional(),
  fecha_hasta: z.string().nullable().optional(),
  search: z.string().max(120).nullable().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const createEventSchema = z
  .object({
    lote_id: uuid.optional(),
    lot_id: uuid.optional(),
    predio_id: uuid.nullable().optional(),
    farm_id: uuid.nullable().optional(),
    event_type: z.enum(TRACE_EVENT_TYPES),
    source_module: z.enum(TRACE_SOURCE_MODULES),
    title: z.string().min(3).max(200),
    description: z.string().max(4000).nullable().optional(),
    event_date: z.string().nullable().optional(),
    executor_id: z.string().max(150).nullable().optional(),
    executor_name: z.string().max(150).nullable().optional(),
    role_at_event: z.string().max(100).nullable().optional(),
    latitud: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitud: z.coerce.number().min(-180).max(180).nullable().optional(),
    precision_gps: z.coerce.number().min(0).nullable().optional(),
    ubicacion_texto: z.string().max(300).nullable().optional(),
    estado: z.enum(TRACE_ESTADOS).default('COMPLETADO').optional(),
    metadata: z.record(z.string(), z.any()).default({}).optional(),
    evidencia_urls: z.array(z.string().url().or(z.string())).default([]).optional(),
    source_table: z.string().max(80).nullable().optional(),
    source_id: uuid.nullable().optional(),
    source_code: z.string().max(60).nullable().optional()
  })
  .refine((d) => d.lote_id || d.lot_id, { message: 'lote_id requerido', path: ['lote_id'] });

export const verifyChainSchema = z.object({
  lote_id: uuid
});

export default { listEventsSchema, createEventSchema, verifyChainSchema };
