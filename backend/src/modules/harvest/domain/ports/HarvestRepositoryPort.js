/**
 * HarvestRepositoryPort — puerto outbound para módulo Cosecha y Postcosecha.
 * Respeta aislamiento multiempresa: todos los métodos reciben companyId y validan pertenencia.
 */
export class HarvestRepositoryPort {
  async createHarvest(companyId, userId, data) {
    throw new Error('Not implemented');
  }
  async listHarvests(companyId, filters) {
    throw new Error('Not implemented');
  }
  async getHarvestById(companyId, harvestId) {
    throw new Error('Not implemented');
  }
  async updateHarvest(companyId, harvestId, data) {
    throw new Error('Not implemented');
  }
  async deleteHarvest(companyId, harvestId) {
    throw new Error('Not implemented');
  }
  async getDashboard(companyId, filters) {
    throw new Error('Not implemented');
  }
  async getHistoricoMensual(companyId, year) {
    throw new Error('Not implemented');
  }
  async getPostHarvestStatus(companyId, filters) {
    throw new Error('Not implemented');
  }
  async listLotesProducto(companyId, filters) {
    throw new Error('Not implemented');
  }
  async trazabilidadPorCodigo(companyId, codigo) {
    throw new Error('Not implemented');
  }
  async listAlertas(companyId, limit) {
    throw new Error('Not implemented');
  }
}
export default HarvestRepositoryPort;
