/**
 * ExpressFertilizationController.js
 * Controlador HTTP para el módulo de Fertilización.
 * Extrae parámetros del request, invoca use cases y formatea la respuesta.
 */
import { ValidationError } from '../../../../../shared/errors/AppErrors.js';

export class ExpressFertilizationController {
  /**
   * @param {import('../../../application/get-plan-detail.usecase.js').GetPlanDetailUseCase} getPlanDetailUC
   * @param {import('../../../application/save-plan.usecase.js').SavePlanUseCase} savePlanUC
   * @param {import('../../../application/save-observation.usecase.js').SaveObservationUseCase} saveObservationUC
   * @param {import('../../../application/complete-application.usecase.js').CompleteApplicationUseCase} completeAppUC
   * @param {import('../../../application/export-plan-pdf.usecase.js').ExportPlanPdfUseCase} exportPdfUC
   * @param {import('../../../infrastructure/adapters/outbound/SupabaseFertilizationRepository.js').SupabaseFertilizationRepository} repository
   * @param {import('../../../infrastructure/adapters/outbound/FertilizationStorageAdapter.js').FertilizationStorageAdapter} storageAdapter
   */
  constructor(
    getPlanDetailUC,
    savePlanUC,
    saveObservationUC,
    completeAppUC,
    exportPdfUC,
    repository,
    storageAdapter
  ) {
    this.getPlanDetailUC = getPlanDetailUC;
    this.savePlanUC = savePlanUC;
    this.saveObservationUC = saveObservationUC;
    this.completeAppUC = completeAppUC;
    this.exportPdfUC = exportPdfUC;
    this.repository = repository;
    this.storageAdapter = storageAdapter;

    // Bind para evitar pérdida de contexto en Express
    this.getPlanDetail = this.getPlanDetail.bind(this);
    this.patchPlan = this.patchPlan.bind(this);
    this.postObservation = this.postObservation.bind(this);
    this.postComment = this.postComment.bind(this);
    this.completeApplication = this.completeApplication.bind(this);
    this.exportPdf = this.exportPdf.bind(this);
    this.uploadAttachment = this.uploadAttachment.bind(this);
  }

  // ─── Helper: extraer company_id y user_id del request ─────────────────────
  _getAuth(req) {
    const companyId = req.user?.company_id || req.user?.empresa_id || req.auth?.orgId || null;
    const userId = req.user?.id || req.auth?.userId || req.auth?.sub || null;
    const userName = req.user?.name || req.user?.full_name || null;
    return { companyId, userId, userName };
  }

  // ─── GET /api/v1/fertilizacion/planes/:planId ─────────────────────────────
  async getPlanDetail(req, res, next) {
    try {
      const { planId } = req.params;
      const { companyId, userId } = this._getAuth(req);
      const detail = await this.getPlanDetailUC.execute(planId, companyId, userId);
      res.json({ success: true, data: detail, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── PATCH /api/v1/fertilizacion/planes/:planId ───────────────────────────
  async patchPlan(req, res, next) {
    try {
      const { planId } = req.params;
      const { companyId, userId } = this._getAuth(req);
      const result = await this.savePlanUC.execute(planId, companyId, userId, req.body);
      res.json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── POST /api/v1/fertilizacion/planes/:planId/observaciones ──────────────
  async postObservation(req, res, next) {
    try {
      const { planId } = req.params;
      const { companyId, userId, userName } = this._getAuth(req);
      const result = await this.saveObservationUC.execute(
        planId,
        companyId,
        userId,
        userName,
        req.body
      );
      res.status(201).json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── POST /api/v1/fertilizacion/observaciones/:observationId/comentarios ──
  async postComment(req, res, next) {
    try {
      const { observationId } = req.params;
      const { companyId, userId, userName } = this._getAuth(req);
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        throw new ValidationError('El comentario no puede estar vacío');
      }

      const result = await this.repository.addComment(observationId, companyId, {
        authorUserId: userId,
        authorName: userName,
        content: content.trim()
      });
      res.status(201).json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── POST /api/v1/fertilizacion/aplicaciones/:applicationId/completar ─────
  async completeApplication(req, res, next) {
    try {
      const { applicationId } = req.params;
      const { companyId, userId } = this._getAuth(req);
      const result = await this.completeAppUC.execute(applicationId, companyId, userId, req.body);
      res.json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /api/v1/fertilizacion/planes/:planId/exportar.pdf ────────────────
  async exportPdf(req, res, next) {
    try {
      const { planId } = req.params;
      const { companyId } = this._getAuth(req);
      const { buffer, contentType, filename } = await this.exportPdfUC.execute(planId, companyId);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // ─── POST /api/v1/fertilizacion/uploads/adjunto-observacion ──────────────
  async uploadAttachment(req, res, next) {
    try {
      const { companyId, userId } = this._getAuth(req);
      const { observationId, fileName, mimeType } = req.body;

      if (!observationId || !fileName) {
        throw new ValidationError('observationId y fileName son requeridos');
      }

      // El archivo viene en req.body como base64 o en un campo multipart
      // Para simplificar, se recibe el archivo como Buffer desde el body (raw)
      const fileBuffer = req.file?.buffer || Buffer.from(req.body.fileBase64 || '', 'base64');

      if (!fileBuffer.length) {
        throw new ValidationError('El archivo está vacío');
      }

      const filePath = await this.storageAdapter.uploadAttachment(
        companyId,
        observationId,
        fileBuffer,
        fileName,
        mimeType
      );

      res.status(201).json({
        success: true,
        data: { filePath, fileName, mimeType },
        error: null
      });
    } catch (err) {
      next(err);
    }
  }
}
