/**
 * Puerto del repositorio de Costos (contrato; implementación en
 * infrastructure/adapters/outbound/SupabaseCostsRepository.js).
 */
export class CostsRepositoryPort {
  async registerEvent(_companyId, _userId, _data) {
    throw new Error('Not implemented');
  }
  async valueEvent(_companyId, _userId, _eventId) {
    throw new Error('Not implemented');
  }
  async allocateEvent(_companyId, _userId, _eventId) {
    throw new Error('Not implemented');
  }
  async postEvent(_companyId, _userId, _eventId) {
    throw new Error('Not implemented');
  }
  async reverseEvent(_companyId, _userId, _eventId, _reason) {
    throw new Error('Not implemented');
  }
  async recalculate(_companyId, _userId, _scope) {
    throw new Error('Not implemented');
  }
  async getEventById(_companyId, _eventId) {
    throw new Error('Not implemented');
  }
  async listEvents(_companyId, _filters) {
    throw new Error('Not implemented');
  }
  async getLaborSummary(_companyId, _laborId) {
    throw new Error('Not implemented');
  }
  async getLoteSummary(_companyId, _loteId, _opts) {
    throw new Error('Not implemented');
  }
  async getPredioKpis(_companyId, _predioId, _opts) {
    throw new Error('Not implemented');
  }
  async getMachineryKpis(_companyId, _maquinariaId, _opts) {
    throw new Error('Not implemented');
  }
  async listEntries(_companyId, _filters) {
    throw new Error('Not implemented');
  }
  async listIssues(_companyId, _filters) {
    throw new Error('Not implemented');
  }
}
export default CostsRepositoryPort;
