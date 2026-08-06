/**
 * export-plan-pdf.usecase.js
 * Caso de uso: Exportar el plan de fertilización a PDF.
 *
 * Estrategia actual: window.print() compatible (genera HTML estructurado).
 * El PDF se genera server-side usando el adaptador PDF.
 * Si el adaptador no está disponible, lanza un error descriptivo.
 */
import { NotFoundError, AuthorizationError } from '../../../shared/errors/AppErrors.js';

export class ExportPlanPdfUseCase {
  /**
   * @param {import('../domain/ports.js').FertilizationRepositoryPort} repository
   * @param {import('../domain/ports.js').FertilizationPdfPort} pdfAdapter
   */
  constructor(repository, pdfAdapter) {
    this.repository = repository;
    this.pdfAdapter = pdfAdapter;
  }

  /**
   * @param {string} planId
   * @param {string} companyId
   * @returns {Promise<Buffer>} Buffer del PDF
   */
  async execute(planId, companyId) {
    if (!companyId) {
      throw new AuthorizationError('Empresa no identificada en la sesión');
    }

    const detail = await this.repository.getPlanDetail(planId, companyId);
    if (!detail || detail.error) {
      throw new NotFoundError(`Plan ${planId} no encontrado`);
    }

    return await this.pdfAdapter.generatePlanPdf(detail);
  }
}
