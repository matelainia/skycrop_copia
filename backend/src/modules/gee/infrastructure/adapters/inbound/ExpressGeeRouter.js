import express from 'express';
import { SupabaseGeeCacheRepository } from '../outbound/SupabaseGeeCacheRepository.js';
import { EarthEngineServiceAdapter } from '../outbound/EarthEngineServiceAdapter.js';
import { ProcessGeeIndexUseCase } from '../../../application/usecases/ProcessGeeIndexUseCase.js';
import { ExpressGeeController } from './ExpressGeeController.js';

const router = express.Router();

// 1. Instanciación de componentes de la Arquitectura Hexagonal
const cacheRepository = new SupabaseGeeCacheRepository();
export const geeService = new EarthEngineServiceAdapter();

const processGeeIndexUseCase = new ProcessGeeIndexUseCase(cacheRepository, geeService);
const controller = new ExpressGeeController(processGeeIndexUseCase);

// 2. Definición de rutas
// POST /api/v1/gee/index -> Procesar análisis satelital y retornar índices con tiles
router.post('/index', express.json(), controller.processIndex);

export const geeRouter = router;
export default geeRouter;
