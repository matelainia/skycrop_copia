import { resolveTenant } from '../../../../../shared/middleware/authenticate.js';

export class ExpressEvaluationController {
  constructor(createEvaluationUseCase, draftEvaluationUseCase, geocodeLoteUseCase) {
    this.createEvaluationUseCase = createEvaluationUseCase;
    this.draftEvaluationUseCase = draftEvaluationUseCase;
    this.geocodeLoteUseCase = geocodeLoteUseCase;
  }

  /**
   * Resuelve la identidad priorizando el token verificado; los valores de
   * query/body solo se aceptan como fallback en desarrollo.
   */
  _identity(req) {
    return resolveTenant(req, {
      fallbackCompanyId: req.query?.companyId ?? req.body?.companyId ?? null,
      fallbackUserId: req.query?.userId ?? req.body?.userId ?? null
    });
  }

  /**
   * POST /api/v1/evaluaciones
   */
  createEvaluation = async (req, res, next) => {
    try {
      const payload = {
        ...req.body,
        ...(req.tenant?.userId ? { user_id: req.tenant.userId } : {}),
        ...(req.tenant?.companyId ? { company_id: req.tenant.companyId } : {})
      };
      const result = await this.createEvaluationUseCase.execute(payload);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/evaluaciones/draft
   */
  saveDraft = async (req, res, next) => {
    try {
      const payload = {
        ...req.body,
        ...(req.tenant?.userId ? { user_id: req.tenant.userId } : {}),
        ...(req.tenant?.companyId ? { company_id: req.tenant.companyId } : {})
      };
      const result = await this.draftEvaluationUseCase.saveDraft(payload);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/evaluaciones/draft/:loteId
   */
  getDraft = async (req, res, next) => {
    try {
      const { loteId } = req.params;
      const identity = this._identity(req);
      const userId = identity.userId || req.query.userId;
      const companyId = identity.companyId || req.query.companyId;

      if (!loteId || !userId || !companyId) {
        return res
          .status(400)
          .json({ success: false, error: 'loteId, userId y companyId son requeridos' });
      }

      const result = await this.draftEvaluationUseCase.getDraft(loteId, userId, companyId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/evaluaciones/geocode
   */
  geocodeLote = async (req, res, next) => {
    try {
      const { loteId } = req.body;
      if (!loteId) {
        return res
          .status(400)
          .json({ success: false, error: 'loteId es requerido en el cuerpo de la petición' });
      }

      const result = await this.geocodeLoteUseCase.execute(loteId);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
