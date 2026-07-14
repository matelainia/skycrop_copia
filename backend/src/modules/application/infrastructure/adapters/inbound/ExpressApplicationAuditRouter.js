import express from 'express';
import { SupabaseApplicationAuditRepository } from '../outbound/SupabaseApplicationAuditRepository.js';
import { ConfirmHighToxicityAuditUseCase } from '../../../application/usecases/ConfirmHighToxicityAuditUseCase.js';
import { EnrichApplicationStateAuditUseCase } from '../../../application/usecases/EnrichApplicationStateAuditUseCase.js';
import { ExpressApplicationAuditController } from './ExpressApplicationAuditController.js';

const router = express.Router();

// 1. Instanciación de componentes de la Arquitectura Hexagonal
const auditRepository = new SupabaseApplicationAuditRepository();

const confirmHighToxicityAuditUseCase = new ConfirmHighToxicityAuditUseCase(auditRepository);
const enrichApplicationStateAuditUseCase = new EnrichApplicationStateAuditUseCase(auditRepository);

const controller = new ExpressApplicationAuditController(
  confirmHighToxicityAuditUseCase,
  enrichApplicationStateAuditUseCase
);

// 2. Definición de rutas
// POST /api/v1/auditoria/alta-toxicidad -> Registrar confirmación de leída de advertencia
router.post('/alta-toxicidad', express.json(), controller.confirmToxicity);

// POST /api/v1/auditoria/estado-aplicacion -> Enriquecer IP/User-Agent
router.post('/estado-aplicacion', express.json(), controller.enrichState);

export const applicationAuditRouter = router;
export default applicationAuditRouter;
