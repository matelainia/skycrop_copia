import { z } from 'zod';

export const RequestSchema = z.object({
  cultivo: z.string().min(1, 'El cultivo es requerido'),
  areaHa: z.number().positive('El área debe ser mayor a 0'),
  region: z.string().default('Tolima'),
  lat: z.number().optional().default(3.54),
  lon: z.number().optional().default(-76.52),
  etapa: z.string().min(1, 'La etapa es requerida'),
  fechaInicio: z.string().min(1, 'La fecha de inicio es requerida'),
  presupuestoMax: z.number().optional(),
  suelo: z
    .object({
      ph: z.number().optional(),
      N: z.number().optional(),
      P: z.number().optional(),
      K: z.number().optional(),
    })
    .optional(),
  plagas: z.array(z.string()).optional(),
});

export const PlanSchema = z.object({
  resumen: z.string(),
  aplicaciones: z.array(
    z.object({
      fecha: z.string(),
      productoId: z.number().or(z.string()).optional(),
      productoNombre: z.string(),
      dosis: z.number(),
      costo: z.number(),
      justificacion: z.string(),
      metodo: z.string().optional(),
    })
  ),
  presupuestoTotal: z.number(),
});
