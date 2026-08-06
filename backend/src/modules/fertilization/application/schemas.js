/**
 * schemas.js
 * Validaciones Zod para el módulo de Fertilización.
 * Importar z desde zod — ya instalado en el proyecto.
 */
import { z } from 'zod';

// ─── Esquema para guardar observación ─────────────────────────────────────────
export const saveObservationSchema = z.object({
  planId: z.string().uuid({ message: 'planId debe ser un UUID válido' }),
  observationId: z.string().uuid().optional().nullable(),
  applicationId: z.string().uuid().optional().nullable(),
  type: z.enum(['note', 'symptom', 'foliar_analysis', 'application', 'soil', 'climate'], {
    message: 'Tipo de observación inválido'
  }),
  title: z.string().max(200).optional().nullable(),
  content: z
    .string()
    .min(5, { message: 'El contenido debe tener al menos 5 caracteres' })
    .max(5000),
  authorName: z.string().max(200).optional(),
  isAlert: z.boolean().default(false),
  severity: z.enum(['low', 'medium', 'high']).optional().nullable(),
  affectedPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  sector: z.string().max(200).optional().nullable(),
  observedAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).default({}),
  attachments: z
    .array(
      z.object({
        filePath: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().optional(),
        sizeBytes: z.number().int().positive().optional()
      })
    )
    .default([]),
  nutrients: z
    .array(
      z.object({
        elementCode: z.string().min(1).max(20),
        elementName: z.string().max(100).optional(),
        value: z.coerce.number(),
        unit: z.string().max(20).default('%'),
        status: z.enum(['low', 'optimal', 'high']).optional(),
        targetMin: z.coerce.number().optional().nullable(),
        targetMax: z.coerce.number().optional().nullable(),
        labReportCode: z.string().max(100).optional().nullable(),
        sampleDate: z.coerce.date().optional().nullable()
      })
    )
    .default([])
});

// ─── Esquema para completar aplicación ───────────────────────────────────────
export const completeApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  completionNote: z.string().max(2000).optional().nullable(),
  doseApplied: z.coerce.number().positive().optional().nullable(),
  doseUnit: z.string().max(50).optional().nullable(),
  completedDate: z.coerce.date().optional()
});

// ─── Esquema para guardar comentario ─────────────────────────────────────────
export const saveCommentSchema = z.object({
  content: z.string().min(1, { message: 'El comentario no puede estar vacío' }).max(2000),
  authorName: z.string().max(200).optional()
});

// ─── Esquema para guardar/editar plan ─────────────────────────────────────────
export const savePlanSchema = z.object({
  loteId: z.string().uuid().optional().nullable(),
  name: z.string().min(3).max(300),
  version: z.string().max(20).default('v1.0'),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).default('draft'),
  validityStatus: z.enum(['scheduled', 'in_progress', 'expired', 'completed']).default('scheduled'),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  periodLabel: z.string().max(100).optional().nullable(),
  budgetTotal: z.coerce.number().min(0).default(0),
  responsibleName: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  // Snapshot del lote
  cropName: z.string().max(200).optional().nullable(),
  cropScientific: z.string().max(200).optional().nullable(),
  lotName: z.string().max(200).optional().nullable(),
  sectorName: z.string().max(200).optional().nullable(),
  farmName: z.string().max(200).optional().nullable(),
  areaHa: z.coerce.number().positive().optional().nullable(),
  soilType: z.string().max(200).optional().nullable(),
  density: z.string().max(100).optional().nullable(),
  phenologicalStage: z.string().max(100).optional().nullable()
});

// ─── Esquema para upload de adjunto ──────────────────────────────────────────
export const uploadAttachmentSchema = z.object({
  observationId: z.string().uuid({ message: 'observationId debe ser un UUID válido' }),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().optional()
});
