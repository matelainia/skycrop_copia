import { z } from 'zod';

// Vocabulario cerrado = el de 065_costos_produccion.sql. Nada de organization_id.
export const SOURCE_MODULES = [
  'labores',
  'maquinaria',
  'combustible',
  'mantenimiento',
  'inventario',
  'aplicaciones',
  'fertilization',
  'nominas',
  'cosecha',
  'ventas',
  'finanzas',
  'manual'
];

export const EVENT_TYPES = [
  'input_consumption',
  'labor_usage',
  'machine_usage',
  'fuel_consumption',
  'maintenance_cost',
  'external_service',
  'depreciation',
  'overhead_expense',
  'harvest_output',
  'sale_revenue',
  'estimated_revenue',
  'other_income',
  'other_expense',
  'correction'
];

const uuidOpt = z.string().uuid().nullable().optional();

export const registerCostEventSchema = z
  .object({
    source_module: z.enum(SOURCE_MODULES),
    source_entity: z.string().min(1).max(120),
    source_id: z.string().uuid(),
    source_version: z.coerce.number().int().min(1).default(1).optional(),
    event_type: z.enum(EVENT_TYPES),
    occurred_at: z.coerce.date(),
    business_date: z.coerce.date().optional(),
    predio_id: uuidOpt,
    lote_id: uuidOpt,
    labor_id: uuidOpt,
    operacion_id: uuidOpt,
    maquinaria_id: uuidOpt,
    inventario_id: uuidOpt,
    trabajador_id: uuidOpt,
    cosecha_id: uuidOpt,
    venta_id: uuidOpt,
    quantity: z.coerce.number().positive().nullable().optional(),
    source_unit: z.string().max(20).nullable().optional(),
    provided_unit_price: z.coerce.number().nonnegative().nullable().optional(),
    provided_amount: z.coerce.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).default('COP').optional(),
    fx_rate: z.coerce.number().positive().default(1).optional(),
    idempotency_key: z.string().max(200).nullable().optional(),
    payload: z.record(z.unknown()).default({}).optional()
  })
  .superRefine((v, ctx) => {
    const dims = [
      v.predio_id,
      v.lote_id,
      v.labor_id,
      v.operacion_id,
      v.maquinaria_id,
      v.inventario_id,
      v.trabajador_id,
      v.cosecha_id,
      v.venta_id
    ].filter(Boolean);
    // Overhead manual a nivel empresa se permite sin dimensión (será indirecto);
    // el resto exige al menos una dimensión productiva mínima.
    if (
      dims.length === 0 &&
      !(v.source_module === 'finanzas' && v.event_type === 'overhead_expense') &&
      !(v.source_module === 'manual')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Se requiere al menos una dimensión: predio_id, lote_id, labor_id, operacion_id, maquinaria_id, inventario_id, trabajador_id, cosecha_id o venta_id.',
        path: ['lote_id']
      });
    }
    if (v.currency && v.currency !== 'COP' && (!v.fx_rate || v.fx_rate === 1)) {
      // No se rechaza: el motor lo marcará fx_missing (066). Solo se advierte vía issue.
    }
  });

export const reverseCostEventSchema = z.object({
  reason: z.string().min(5, 'Motivo obligatorio (mín. 5 caracteres)').max(500)
});

export const recalculateCostsSchema = z.object({
  mode: z
    .enum(['full', 'incremental', 'labor', 'lote', 'predio', 'maquina', 'periodo'])
    .default('incremental'),
  labor_id: uuidOpt,
  lote_id: uuidOpt,
  predio_id: uuidOpt,
  maquinaria_id: uuidOpt,
  period_start: z.coerce.date().nullable().optional(),
  period_end: z.coerce.date().nullable().optional()
});

export const uuidParamSchema = z.object({ id: z.string().uuid() });

export const listEntriesSchema = z.object({
  labor_id: uuidOpt,
  lote_id: uuidOpt,
  predio_id: uuidOpt,
  maquinaria_id: uuidOpt,
  cost_class: z.string().max(40).nullable().optional(),
  status: z.enum(['posted', 'reversed']).nullable().optional(),
  date_from: z.coerce.date().nullable().optional(),
  date_to: z.coerce.date().nullable().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
});

export const listIssuesSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'ignored']).nullable().optional(),
  issue_type: z.string().max(40).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
});

export default {
  SOURCE_MODULES,
  EVENT_TYPES,
  registerCostEventSchema,
  reverseCostEventSchema,
  recalculateCostsSchema,
  listEntriesSchema,
  listIssuesSchema
};
