import express from 'express';
import { SupabaseAgronomyRepository } from '../outbound/SupabaseAgronomyRepository.js';
import { SupabaseProtocolRepository } from '../outbound/SupabaseProtocolRepository.js';
import { SupabaseObjectRepository } from '../outbound/SupabaseObjectRepository.js';
import { GetFormularioMonitoreoUseCase } from '../../../application/usecases/GetFormularioMonitoreoUseCase.js';
import { GetCropsUseCase } from '../../../application/usecases/GetCropsUseCase.js';
import { GetRecommendationsUseCase } from '../../../application/usecases/GetRecommendationsUseCase.js';
import { ProtocolService } from '../../../application/usecases/ProtocolService.js';
import { ExpressAgronomyController } from './ExpressAgronomyController.js';

const router = express.Router();

// ─── Composición de Dependencias ───────────────────────────────────────────────────
const agronomyRepo = new SupabaseAgronomyRepository();
const protocolRepo = new SupabaseProtocolRepository();
const objectRepo = new SupabaseObjectRepository();

// Capa de Dominio: ProtocolService recibe el repositorio y orquesta la lógica de negocio
const protocolService = new ProtocolService(protocolRepo);

const getFormularioUseCase = new GetFormularioMonitoreoUseCase(agronomyRepo);
const getCropsUseCase = new GetCropsUseCase(objectRepo);
const getRecommendationsUseCase = new GetRecommendationsUseCase(objectRepo);

const controller = new ExpressAgronomyController(
  getFormularioUseCase,
  getCropsUseCase,
  getRecommendationsUseCase,
  agronomyRepo,
  protocolRepo,
  objectRepo,
  protocolService // ← nueva capa de dominio
);

// ─── CATÁLOGOS ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/agronomia/lotes/:id/formulario-monitoreo
 * Endpoint atómico: cultivo + estado fenológico + objetos + protocolos + umbrales + reglas.
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
 * Tratamientos disponibles para un objeto de evaluación.
 */
router.get('/objetos/:objetoId/recomendaciones', controller.getRecomendaciones);

// ─── PROTOCOLOS ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/agronomia/protocolos
 * Lista/biblioteca de protocolos con filtros opcionales.
 * Query: cultivo_id, objeto_id, estado, created_by, search
 */
router.get('/protocolos', controller.listProtocolos);

/**
 * GET /api/v1/agronomia/protocolos/:id
 * Detalle completo de un protocolo (con historial de versiones).
 */
router.get('/protocolos/:id', controller.getProtocoloById);

/**
 * POST /api/v1/agronomia/protocolos
 * Crear un nuevo protocolo (borrador o publicar directamente).
 */
router.post('/protocolos', controller.saveProtocolo);

/**
 * PUT /api/v1/agronomia/protocolos/:id
 * Actualizar un protocolo (permite cambiar estado: borrador → activo → archivado → obsoleto).
 */
router.put('/protocolos/:id', controller.updateProtocolo);

/**
 * DELETE /api/v1/agronomia/protocolos/:id
 * Eliminar un protocolo existente.
 */
router.delete('/protocolos/:id', controller.deleteProtocolo);

/**
 * POST /api/v1/agronomia/protocolos/:id/clone
 * Clonar un protocolo como borrador v1.0.
 */
router.post('/protocolos/:id/clone', controller.cloneProtocolo);

/**
 * POST /api/v1/agronomia/protocolos/import
 * Importar un protocolo completo desde JSON externo.
 */
router.post('/protocolos/import', controller.importProtocolo);

/**
 * POST /api/v1/agronomia/protocolos/:id/publicar
 * Transicionar borrador → activo. Archiva la versión previa del mismo objeto.
 */
router.post('/protocolos/:id/publicar', controller.publicarProtocolo);

/**
 * GET /api/v1/agronomia/protocolos/:objetoId/historial
 * Historial de versiones del mismo objeto de evaluación.
 */
router.get('/protocolos/:objetoId/historial', controller.getHistorialVersiones);

export const agronomyRouter = router;
export default agronomyRouter;
