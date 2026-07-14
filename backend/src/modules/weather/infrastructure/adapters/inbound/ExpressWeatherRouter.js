import express from 'express';
import { SupabaseWeatherCacheRepository } from '../outbound/SupabaseWeatherCacheRepository.js';
import { GoogleWeatherAdapter } from '../outbound/GoogleWeatherAdapter.js';
import { OpenMeteoWeatherAdapter } from '../outbound/OpenMeteoWeatherAdapter.js';
import { GetWeatherForecastUseCase } from '../../../application/usecases/GetWeatherForecastUseCase.js';
import { ExpressWeatherController } from './ExpressWeatherController.js';

const router = express.Router();

// 1. Instanciación de componentes de la Arquitectura Hexagonal
const cacheRepository = new SupabaseWeatherCacheRepository();
const googleProvider = new GoogleWeatherAdapter();
const openMeteoProvider = new OpenMeteoWeatherAdapter();

const getWeatherForecastUseCase = new GetWeatherForecastUseCase(
  cacheRepository,
  googleProvider,
  openMeteoProvider
);

const controller = new ExpressWeatherController(getWeatherForecastUseCase);

// 2. Definición de rutas
// GET /api/v1/weather?latitude=X&longitude=Y -> Obtener pronóstico y alertas climatológicas
router.get('/', controller.getForecast);

export const weatherRouter = router;
export default weatherRouter;
