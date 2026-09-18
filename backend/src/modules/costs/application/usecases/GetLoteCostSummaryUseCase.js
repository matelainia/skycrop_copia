import { AuthorizationError, ValidationError } from '../../../../shared/errors/AppErrors.js';
import { assertCostsPermission } from '../CostsPermissions.js';

export class GetLoteCostSummaryUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, loteId, opts = {}) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'leer');
    if (!loteId) throw new ValidationError('lote_id requerido');
    return await this.repository.getLoteSummary(companyId, loteId, opts);
  }
}
export default GetLoteCostSummaryUseCase;
