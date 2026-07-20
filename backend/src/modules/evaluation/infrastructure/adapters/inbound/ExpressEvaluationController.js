export class ExpressEvaluationController {
  constructor(createEvaluationUseCase, draftEvaluationUseCase, geocodeLoteUseCase) {
    this.createEvaluationUseCase = createEvaluationUseCase;
    this.draftEvaluationUseCase = draftEvaluationUseCase;
    this.geocodeLoteUseCase = geocodeLoteUseCase;
  }

  /**
   * POST /api/v1/evaluaciones
   */
  createEvaluation = async (req, res, next) => {
    try {
      const payload = req.body;
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
      const payload = req.body;
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
      const { userId, companyId } = req.query;

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
