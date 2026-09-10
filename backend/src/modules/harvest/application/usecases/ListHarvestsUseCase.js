import { AuthorizationError } from '../../../../shared/errors/AppErrors.js';
import { listHarvestsSchema } from '../schemas.js';

export class ListHarvestsUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, rawFilters) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    const parsed = listHarvestsSchema.safeParse(rawFilters || {});
    const filters = parsed.success ? parsed.data : { page: 1, limit: 20 };
    return await this.repository.listHarvests(companyId, filters);
  }
}
export default ListHarvestsUseCase;
