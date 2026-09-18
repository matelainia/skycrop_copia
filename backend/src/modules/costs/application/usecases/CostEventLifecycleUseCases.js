import { AuthorizationError, ValidationError } from '../../../../shared/errors/AppErrors.js';
import { uuidParamSchema, reverseCostEventSchema } from '../schemas.js';
import { assertCostsPermission } from '../CostsPermissions.js';

function requireId(id) {
  const parsed = uuidParamSchema.safeParse({ id });
  if (!parsed.success) throw new ValidationError('id de evento inválido');
  return parsed.data.id;
}

export class ValueCostEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, eventId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'crear');
    return await this.repository.valueEvent(companyId, userId, requireId(eventId));
  }
}

export class AllocateCostEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, eventId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'crear');
    return await this.repository.allocateEvent(companyId, userId, requireId(eventId));
  }
}

export class PostCostEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, eventId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'crear');
    return await this.repository.postEvent(companyId, userId, requireId(eventId));
  }
}

export class ReverseCostEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, eventId, rawBody) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    await assertCostsPermission(companyId, userId, 'eliminar');
    const parsed = reverseCostEventSchema.safeParse(rawBody || {});
    if (!parsed.success)
      throw new ValidationError('Motivo de reverso inválido', parsed.error.errors);
    return await this.repository.reverseEvent(
      companyId,
      userId,
      requireId(eventId),
      parsed.data.reason
    );
  }
}

export default {
  ValueCostEventUseCase,
  AllocateCostEventUseCase,
  PostCostEventUseCase,
  ReverseCostEventUseCase
};
