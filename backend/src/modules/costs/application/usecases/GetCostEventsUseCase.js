import { AuthorizationError, ValidationError } from '../../../../shared/errors/AppErrors.js';
import { listCostEventsSchema } from '../schemas.js';
import { assertCostsPermission } from '../CostsPermissions.js';

export class GetCostEventsUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, rawFilters) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'leer');
    const parsed = listCostEventsSchema.safeParse(rawFilters || {});
    if (!parsed.success) throw new ValidationError('Filtros inválidos', parsed.error.errors);
    return await this.repository.listEvents(companyId, parsed.data);
  }
}
export default GetCostEventsUseCase;
