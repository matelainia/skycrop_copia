/**
 * TraceabilityRepositoryPort — puerto outbound del sistema de evidencia inmutable.
 * Solo lectura para usuarios; la escritura ocurre únicamente vía SkyCrop Core
 * (service_role / RPC registrar_evento_trazabilidad_empresa).
 */
export class TraceabilityRepositoryPort {
  async listEvents(companyId, filters) {
    throw new Error('Not implemented');
  }
  async getEventById(companyId, eventId) {
    throw new Error('Not implemented');
  }
  async createEvent(companyId, userId, userName, data) {
    throw new Error('Not implemented');
  }
  async verifyEvent(companyId, eventId) {
    throw new Error('Not implemented');
  }
  async verifyChain(companyId, loteId) {
    throw new Error('Not implemented');
  }
  async getAuditInfo(companyId, eventId) {
    throw new Error('Not implemented');
  }
  async getLotSummary(companyId, loteId) {
    throw new Error('Not implemented');
  }
}
export default TraceabilityRepositoryPort;
