import { ValidationError, AuthorizationError } from '../../../shared/errors/AppErrors.js';
import { listEventsSchema, createEventSchema } from './schemas.js';

export class ListEventsUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, rawFilters = {}) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    const parsed = listEventsSchema.safeParse(rawFilters);
    if (!parsed.success)
      throw new ValidationError('Filtros de trazabilidad inválidos', parsed.error.errors);
    return await this.repository.listEvents(companyId, parsed.data);
  }
}

export class GetEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, eventId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    if (!eventId) throw new ValidationError('eventId requerido');
    return await this.repository.getEventById(companyId, eventId);
  }
}

export class CreateEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, userId, userName, rawData) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    const parsed = createEventSchema.safeParse(rawData);
    if (!parsed.success)
      throw new ValidationError('Datos de evento inválidos', parsed.error.errors);
    return await this.repository.createEvent(companyId, userId, userName, parsed.data);
  }
}

export class VerifyEventUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, eventId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    return await this.repository.verifyEvent(companyId, eventId);
  }
}

export class VerifyChainUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, loteId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    if (!loteId) throw new ValidationError('lote_id requerido');
    return await this.repository.verifyChain(companyId, loteId);
  }
}

export class AuditInfoUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, eventId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    return await this.repository.getAuditInfo(companyId, eventId);
  }
}

export class LotSummaryUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, loteId) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    if (!loteId) throw new ValidationError('lote_id requerido');
    return await this.repository.getLotSummary(companyId, loteId);
  }
}

export default {
  ListEventsUseCase,
  GetEventUseCase,
  CreateEventUseCase,
  VerifyEventUseCase,
  VerifyChainUseCase,
  AuditInfoUseCase,
  LotSummaryUseCase
};
