import express from 'express';
import { requireAuth } from '../../../../../shared/middleware/authenticate.js';
import { SupabaseCostsRepository } from '../outbound/SupabaseCostsRepository.js';
import { RegisterCostEventUseCase } from '../../../application/usecases/RegisterCostEventUseCase.js';
import {
  ValueCostEventUseCase,
  AllocateCostEventUseCase,
  PostCostEventUseCase,
  ReverseCostEventUseCase
} from '../../../application/usecases/CostEventLifecycleUseCases.js';
import { GetLaborCostSummaryUseCase } from '../../../application/usecases/GetLaborCostSummaryUseCase.js';
import { GetLoteCostSummaryUseCase } from '../../../application/usecases/GetLoteCostSummaryUseCase.js';
import { GetCostEntriesUseCase } from '../../../application/usecases/GetCostEntriesUseCase.js';
import { GetCostIssuesUseCase } from '../../../application/usecases/GetCostIssuesUseCase.js';
import { RecalculateCostsUseCase } from '../../../application/usecases/RecalculateCostsUseCase.js';
import { ExpressCostsController } from './ExpressCostsController.js';

const router = express.Router();

const repository = new SupabaseCostsRepository();
const controller = new ExpressCostsController({
  registerUC: new RegisterCostEventUseCase(repository),
  valueUC: new ValueCostEventUseCase(repository),
  allocateUC: new AllocateCostEventUseCase(repository),
  postUC: new PostCostEventUseCase(repository),
  reverseUC: new ReverseCostEventUseCase(repository),
  laborSummaryUC: new GetLaborCostSummaryUseCase(repository),
  loteSummaryUC: new GetLoteCostSummaryUseCase(repository),
  entriesUC: new GetCostEntriesUseCase(repository),
  issuesUC: new GetCostIssuesUseCase(repository),
  recalcUC: new RecalculateCostsUseCase(repository),
  repository
});

router.use(requireAuth);

// Ciclo de vida 066 (valorizar → asignar → publicar → reversar).
router.post('/eventos', controller.register);
router.post('/eventos/:id/valorizar', controller.value);
router.post('/eventos/:id/asignar', controller.allocate);
router.post('/eventos/:id/publicar', controller.publish);
router.post('/eventos/:id/reversar', controller.reverse);
router.post('/recalcular', controller.recalculate);

// Lectura.
router.get('/labores/:id/resumen', controller.laborSummary);
router.get('/lotes/:id/resumen', controller.loteSummary);
router.get('/predios/:id/kpis', controller.predioKpis);
router.get('/maquinaria/:id/kpis', controller.machineryKpis);
router.get('/entradas', controller.entries);
router.get('/issues', controller.issues);

export const costsRouter = router;
export default costsRouter;
