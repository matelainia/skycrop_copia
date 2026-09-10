/**
 * ExpressFertilizationRouter.js
 * Router Express para el módulo de Fertilización.
 * Composición de dependencias (DI manual) siguiendo el patrón de evaluationRouter.
 */
import express from 'express';
import { requireAuth } from '../../../../../shared/middleware/authenticate.js';

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

// Controlador plan operacional (inbound)
import { ExpressFertilizationController } from './ExpressFertilizationController.js';

// Motor de cálculo determinístico
import { FertilizationCalculationService } from '../../../calculation/services/FertilizationCalculationService.js';
import { ExpressCalculationController } from './ExpressCalculationController.js';

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

// ─── Motor de cálculo (DI) ────────────────────────────────────────────────────
const calculationService = new FertilizationCalculationService();
const calcController = new ExpressCalculationController(calculationService);

// Autenticación obligatoria (permite dev sin token con advertencia, bloquea en producción)
router.use(requireAuth);

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

// ─── Rutas del Motor de Cálculo (/calculo/*) ──────────────────────────────────

// POST  /calculo                          → Ejecutar cálculo determinístico
router.post('/calculo', calcController.postCalculate);

// GET   /calculo/cultivos                 → Catálogo de cultivos
router.get('/calculo/cultivos', calcController.getCrops);

// GET   /calculo/cultivos/:cropId/etapas  → Etapas fenológicas de un cultivo
router.get('/calculo/cultivos/:cropId/etapas', calcController.getStages);

// GET   /calculo/nutrientes               → Catálogo de nutrientes
router.get('/calculo/nutrientes', calcController.getNutrients);

// GET   /calculo/fertilizantes            → Catálogo de fertilizantes
router.get('/calculo/fertilizantes', calcController.getFertilizers);

// GET   /calculo/reglas                   → Reglas agronómicas activas
router.get('/calculo/reglas', calcController.getRules);

// GET   /calculo/requerimientos           → Requerimientos escalados (Paso 2)
router.get('/calculo/requerimientos', calcController.getRequirements);

// POST  /calculo/balance-preview          → Preview Demanda vs Oferta vs Déficit (Paso 3)
router.post('/calculo/balance-preview', calcController.getBalancePreview);

// POST  /calculo/analisis-suelo           → Registrar análisis de suelo
router.post('/calculo/analisis-suelo', calcController.postSoilAnalysis);

// GET   /calculo/historial                → Historial de cálculos de la empresa
router.get('/calculo/historial', calcController.getHistory);

// GET   /calculo/:calculationId           → Detalle de un cálculo con snapshot
router.get('/calculo/:calculationId', calcController.getCalculationDetail);

export const fertilizationRouter = router;
export default fertilizationRouter;
