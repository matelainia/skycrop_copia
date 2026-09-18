import { AuthorizationError } from '../../../../shared/errors/AppErrors.js';
import { listEntriesSchema } from '../schemas.js';
import { ValidationError } from '../../../../shared/errors/AppErrors.js';
import { assertCostsPermission } from '../CostsPermissions.js';

export class GetCostEntriesUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, rawFilters) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'leer');
    const parsed = listEntriesSchema.safeParse(rawFilters || {});
    if (!parsed.success) throw new ValidationError('Filtros inválidos', parsed.error.errors);
    return await this.repository.listEntries(companyId, parsed.data);
  }
}
export default GetCostEntriesUseCase;
