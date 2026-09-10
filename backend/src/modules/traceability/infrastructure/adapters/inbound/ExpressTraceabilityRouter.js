import express from 'express';
import { requireAuth } from '../../../../../shared/middleware/authenticate.js';
import { SupabaseTraceabilityRepository } from '../outbound/SupabaseTraceabilityRepository.js';
import { ExpressTraceabilityController } from './ExpressTraceabilityController.js';
import {
  ListEventsUseCase,
  GetEventUseCase,
  CreateEventUseCase,
  VerifyEventUseCase,
  VerifyChainUseCase,
  AuditInfoUseCase,
  LotSummaryUseCase
} from '../../../application/usecases.js';

const router = express.Router();

const repository = new SupabaseTraceabilityRepository();
const controller = new ExpressTraceabilityController({
  listUC: new ListEventsUseCase(repository),
  getUC: new GetEventUseCase(repository),
  createUC: new CreateEventUseCase(repository),
  verifyUC: new VerifyEventUseCase(repository),
  chainUC: new VerifyChainUseCase(repository),
  auditUC: new AuditInfoUseCase(repository),
  summaryUC: new LotSummaryUseCase(repository),
  repository
});

router.use(requireAuth);

// Consultas de bitácora (antes de :id)
router.get('/export.csv', controller.exportCsv);
router.get('/chain', controller.chain);
router.get('/summary', controller.summary);
router.get('/', controller.list);
// Emisión SkyCrop Core (único escritor)
router.post('/', controller.create);
// Detalle + auditoría + verificación
router.get('/:id/audit', controller.audit);
router.get('/:id/verify', controller.verify);
router.get('/:id', controller.getById);
// Inmutabilidad explícita
router.put('/:id', controller.updateBlocked);
router.patch('/:id', controller.updateBlocked);
router.delete('/:id', controller.deleteBlocked);

export const traceabilityRouter = router;
export default traceabilityRouter;
