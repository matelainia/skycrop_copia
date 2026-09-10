import { AuthorizationError } from '../../../../shared/errors/AppErrors.js';

export class GetDashboardUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  async execute(companyId, filters) {
    if (!companyId) throw new AuthorizationError('Empresa no identificada');
    const dashboard = await this.repository.getDashboard(companyId, filters);
    const historico = await this.repository.getHistoricoMensual(
      companyId,
      new Date().getFullYear()
    );
    const postcosecha = await this.repository.getPostHarvestStatus(companyId, filters);
    const recientes = await this.repository.listHarvests(companyId, {
      page: 1,
      limit: 5,
      periodo: filters?.periodo || 'este_anio'
    });
    const alertas = await this.repository.listAlertas(companyId, 5);
    return { dashboard, historico, postcosecha, recientes, alertas };
  }
}
export default GetDashboardUseCase;
