import express from 'express';
import { SupabaseEvaluationRepository } from '../outbound/SupabaseEvaluationRepository.js';
import { CreateEvaluationUseCase } from '../../../application/usecases/CreateEvaluationUseCase.js';
import { DraftEvaluationUseCase } from '../../../application/usecases/DraftEvaluationUseCase.js';
import { GeocodeLoteUseCase } from '../../../application/usecases/GeocodeLoteUseCase.js';
import { ExpressEvaluationController } from './ExpressEvaluationController.js';

const router = express.Router();

// ─── Composición de Dependencias ─────────────────────────────────────────────
const repository = new SupabaseEvaluationRepository();

const createUseCase = new CreateEvaluationUseCase(repository);
const draftUseCase = new DraftEvaluationUseCase(repository);
const geocodeUseCase = new GeocodeLoteUseCase(repository);

const controller = new ExpressEvaluationController(createUseCase, draftUseCase, geocodeUseCase);

// ─── Rutas del Enrutador ─────────────────────────────────────────────────────

// POST /api/v1/evaluaciones - Guardado final de la evaluación
router.post('/', controller.createEvaluation);

// POST /api/v1/evaluaciones/draft - Guardar borrador (autosave)
router.post('/draft', controller.saveDraft);

// GET /api/v1/evaluaciones/draft/:loteId - Obtener borrador activo
router.get('/draft/:loteId', controller.getDraft);

// POST /api/v1/evaluaciones/geocode - Geocodificación espacial PostGIS/Nominatim
router.post('/geocode', controller.geocodeLote);

export const evaluationRouter = router;
export default evaluationRouter;
