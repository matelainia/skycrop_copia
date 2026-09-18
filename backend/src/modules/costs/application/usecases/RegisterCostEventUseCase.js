import { ValidationError, AuthorizationError } from '../../../../shared/errors/AppErrors.js';
import { registerCostEventSchema } from '../schemas.js';
import { assertCostsPermission } from '../CostsPermissions.js';

/**
 * DRAFT: registra el hecho bruto en costos_eventos (status received).
 * Valorización/asignación/publicación viven en 066 (RPCs). Aquí solo
 * validación + idempotencia por UNIQUE(company,module,entity,id,version,type).
 */
export class RegisterCostEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, rawData) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'crear');
    const parsed = registerCostEventSchema.safeParse(rawData);
    if (!parsed.success) throw new ValidationError('Evento de costo inválido', parsed.error.errors);
    return await this.repository.registerEvent(companyId, userId, parsed.data);
  }
}
export default RegisterCostEventUseCase;
