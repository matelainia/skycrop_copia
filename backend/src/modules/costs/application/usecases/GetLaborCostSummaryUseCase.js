import { AuthorizationError, ValidationError } from '../../../../shared/errors/AppErrors.js';
import { assertCostsPermission } from '../CostsPermissions.js';

export class GetLaborCostSummaryUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, laborId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'leer');
    if (!laborId) throw new ValidationError('labor_id requerido');
    return await this.repository.getLaborSummary(companyId, laborId);
  }
}
export default GetLaborCostSummaryUseCase;
