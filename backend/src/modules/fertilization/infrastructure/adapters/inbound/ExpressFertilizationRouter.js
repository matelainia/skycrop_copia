/**
 * ExpressFertilizationRouter.js
 * Router Express para el módulo de Fertilización.
 * Composición de dependencias (DI manual) siguiendo el patrón de evaluationRouter.
 */
import express from 'express';

// Adaptadores de salida (outbound)
import { SupabaseFertilizationRepository } from '../outbound/SupabaseFertilizationRepository.js';
import { FertilizationStorageAdapter } from '../outbound/FertilizationStorageAdapter.js';
import { FertilizationPdfAdapter } from '../outbound/FertilizationPdfAdapter.js';

// Casos de uso (application)
import { GetPlanDetailUseCase } from '../../../application/get-plan-detail.usecase.js';
import { SavePlanUseCase } from '../../../application/save-plan.usecase.js';
import { SaveObservationUseCase } from '../../../application/save-observation.usecase.js';
import { CompleteApplicationUseCase } from '../../../application/complete-application.usecase.js';
import { ExportPlanPdfUseCase } from '../../../application/export-plan-pdf.usecase.js';
import { SugerirPlanUseCase } from '../../../application/sugerir-plan.usecase.js';

// Controlador (inbound)
import { ExpressFertilizationController } from './ExpressFertilizationController.js';

const router = express.Router();

// ─── Composición de dependencias ──────────────────────────────────────────────
const repository = new SupabaseFertilizationRepository();
const storageAdapter = new FertilizationStorageAdapter();
const pdfAdapter = new FertilizationPdfAdapter();

const getPlanDetailUC = new GetPlanDetailUseCase(repository);
const savePlanUC = new SavePlanUseCase(repository);
const saveObsUC = new SaveObservationUseCase(repository);
const completeAppUC = new CompleteApplicationUseCase(repository);
const exportPdfUC = new ExportPlanPdfUseCase(repository, pdfAdapter);
const sugerirPlanUC = new SugerirPlanUseCase();

const controller = new ExpressFertilizationController(
  getPlanDetailUC,
  savePlanUC,
  saveObsUC,
  completeAppUC,
  exportPdfUC,
  sugerirPlanUC,
  repository,
  storageAdapter
);

// ─── Definición de rutas ──────────────────────────────────────────────────────

// POST /sugerir-plan             → Generar plan base con IA
router.post('/sugerir-plan', controller.sugerirPlan);

// GET  /planes/:planId          → Detalle completo del plan
router.get('/planes/:planId', controller.getPlanDetail);

// PATCH /planes/:planId          → Editar plan
router.patch('/planes/:planId', controller.patchPlan);

// POST /planes/:planId/observaciones  → Nueva observación
router.post('/planes/:planId/observaciones', controller.postObservation);

// POST /observaciones/:obsId/comentarios → Nuevo comentario
router.post('/observaciones/:observationId/comentarios', controller.postComment);

// POST /aplicaciones/:appId/completar → Marcar aplicación como realizada
router.post('/aplicaciones/:applicationId/completar', controller.completeApplication);

// GET  /planes/:planId/exportar.pdf  → Exportar PDF
router.get('/planes/:planId/exportar.pdf', controller.exportPdf);

// POST /uploads/adjunto-observacion  → Subir adjunto
router.post('/uploads/adjunto-observacion', controller.uploadAttachment);

export const fertilizationRouter = router;
export default fertilizationRouter;
