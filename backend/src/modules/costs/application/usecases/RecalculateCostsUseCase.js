import { AuthorizationError, ValidationError } from '../../../../shared/errors/AppErrors.js';
import { recalculateCostsSchema } from '../schemas.js';
import { assertCostsPermission } from '../CostsPermissions.js';

/**
 * Delega en costos_recalculate (066 §7: stub seguro, valida permiso y
 * responde not_implemented → 501). No ejecuta lógica destructiva.
 */
export class RecalculateCostsUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, rawScope) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'editar');
    const parsed = recalculateCostsSchema.safeParse(rawScope || {});
    if (!parsed.success) throw new ValidationError('Scope inválido', parsed.error.errors);
    return await this.repository.recalculate(companyId, userId, parsed.data);
  }
}
export default RecalculateCostsUseCase;
