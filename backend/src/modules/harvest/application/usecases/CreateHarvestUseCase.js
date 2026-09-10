import { ValidationError, AuthorizationError } from '../../../../shared/errors/AppErrors.js';
import { createHarvestSchema } from '../schemas.js';

export class CreateHarvestUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, rawData) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    const parsed = createHarvestSchema.safeParse(rawData);
    if (!parsed.success)
      throw new ValidationError('Datos de cosecha inválidos', parsed.error.errors);
    // Normalizar lote vacío
    const data = { ...parsed.data };
    if (data.lote_agricola_id === '') data.lote_agricola_id = null;
    return await this.repository.createHarvest(companyId, userId, data);
  }
}
export default CreateHarvestUseCase;
