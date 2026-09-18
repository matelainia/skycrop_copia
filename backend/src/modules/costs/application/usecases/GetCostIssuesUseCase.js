import { AuthorizationError, ValidationError } from '../../../../shared/errors/AppErrors.js';
import { listIssuesSchema } from '../schemas.js';
import { assertCostsPermission } from '../CostsPermissions.js';

export class GetCostIssuesUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, rawFilters) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'leer');
    const parsed = listIssuesSchema.safeParse(rawFilters || {});
    if (!parsed.success) throw new ValidationError('Filtros inválidos', parsed.error.errors);
    return await this.repository.listIssues(companyId, parsed.data);
  }
}
export default GetCostIssuesUseCase;
