import express from 'express';
import { SupabaseAgronomyRepository } from '../outbound/SupabaseAgronomyRepository.js';
import { GetFormularioMonitoreoUseCase } from '../../../application/usecases/GetFormularioMonitoreoUseCase.js';
import { GetCropsUseCase } from '../../../application/usecases/GetCropsUseCase.js';
import { GetRecommendationsUseCase } from '../../../application/usecases/GetRecommendationsUseCase.js';
import { ExpressAgronomyController } from './ExpressAgronomyController.js';

const router = express.Router();

// ─── Instanciación (Composición de Dependencias) ─────────────────────────────
const repo = new SupabaseAgronomyRepository();
const getFormularioUseCase = new GetFormularioMonitoreoUseCase(repo);
const getCropsUseCase = new GetCropsUseCase(repo);
const getRecommendationsUseCase = new GetRecommendationsUseCase(repo);

const controller = new ExpressAgronomyController(
  getFormularioUseCase,
  getCropsUseCase,
  getRecommendationsUseCase,
  repo
);

// ─── Rutas ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/agronomia/lotes/:id/formulario-monitoreo
 * Endpoint atómico: cultivo + estado fenológico + objetos + protocolos + umbrales + reglas.
 * El frontend hace UNA sola llamada para construir el formulario dinámico completo.
 */
router.get('/lotes/:id/formulario-monitoreo', controller.getFormularioMonitoreo);

/**
 * GET /api/v1/agronomia/cultivos
 * Catálogo maestro de cultivos activos.
 */
router.get('/cultivos', controller.getCultivos);

/**
 * GET /api/v1/agronomia/cultivos/:cultivoId/estados-fenologicos
 * Estados fenológicos de un cultivo específico.
 */
router.get('/cultivos/:cultivoId/estados-fenologicos', controller.getEstadosFenologicos);

/**
 * GET /api/v1/agronomia/objetos?cultivo_id=...&estado_fenologico_id=...
 * Catálogo de objetos de evaluación, filtrable por cultivo y etapa.
 */
router.get('/objetos', controller.getObjetos);

/**
 * GET /api/v1/agronomia/objetos/:objetoId/recomendaciones
 * Tratamientos disponibles (por ingrediente activo) para un objeto de evaluación.
 */
router.get('/objetos/:objetoId/recomendaciones', controller.getRecomendaciones);

export const agronomyRouter = router;
export default agronomyRouter;
