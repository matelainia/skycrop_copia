import express from 'express';
import { requireAuth } from '../../../../../shared/middleware/authenticate.js';
import { SupabaseHarvestRepository } from '../outbound/SupabaseHarvestRepository.js';
import { CreateHarvestUseCase } from '../../../application/usecases/CreateHarvestUseCase.js';
import { ListHarvestsUseCase } from '../../../application/usecases/ListHarvestsUseCase.js';
import { GetDashboardUseCase } from '../../../application/usecases/GetDashboardUseCase.js';
import { ExpressHarvestController } from './ExpressHarvestController.js';

const router = express.Router();

const repository = new SupabaseHarvestRepository();
const createHarvestUC = new CreateHarvestUseCase(repository);
const listHarvestsUC = new ListHarvestsUseCase(repository);
const dashboardUC = new GetDashboardUseCase(repository);

const controller = new ExpressHarvestController(
  createHarvestUC,
  listHarvestsUC,
  dashboardUC,
  repository
);

router.use(requireAuth);

// Dashboard y trazabilidad antes de :id
router.get('/dashboard', controller.dashboard);
router.get('/trazabilidad', controller.trazabilidad);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);
router.delete('/:id', controller.delete);

export const harvestRouter = router;
export default harvestRouter;
