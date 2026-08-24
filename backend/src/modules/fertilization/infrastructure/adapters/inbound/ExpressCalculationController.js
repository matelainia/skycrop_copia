/**
 * ExpressCalculationController.js
 * Controlador HTTP para el motor de cálculo de fertilización.
 * Extrae params del request, invoca el servicio y formatea la respuesta.
 *
 * Sigue el mismo patrón que ExpressFertilizationController.js existente.
 */
import { ValidationError, AuthenticationError } from '../../../../../shared/errors/AppErrors.js';
import { resolveTenant } from '../../../../../shared/middleware/authenticate.js';

export class ExpressCalculationController {
  /**
   * @param {import('../../../calculation/services/FertilizationCalculationService.js').FertilizationCalculationService} calculationService
   */
  constructor(calculationService) {
    this.calculationService = calculationService;

    // Bind para evitar pérdida de contexto en Express
    this.postCalculate = this.postCalculate.bind(this);
    this.getCrops = this.getCrops.bind(this);
    this.getStages = this.getStages.bind(this);
    this.getNutrients = this.getNutrients.bind(this);
    this.getFertilizers = this.getFertilizers.bind(this);
    this.getRules = this.getRules.bind(this);
    this.postSoilAnalysis = this.postSoilAnalysis.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getCalculationDetail = this.getCalculationDetail.bind(this);
  }

  // ─── Helper: extraer company_id del request ────────────────────────────────
  // Prioriza la identidad verificada del token (req.tenant); los valores
  // enviados por el cliente solo aplican como fallback en desarrollo.
  _getAuth(req) {
    return resolveTenant(req, { fallbackCompanyId: 'company_dev', fallbackUserId: null });
  }

  // ─── POST /calculo ─────────────────────────────────────────────────────────

  /**
   * Ejecuta el cálculo de fertilización determinístico.
   * Body: { cropId, stageId, targetYieldTHa, methodology?, soilAnalysisId?,
   *         lotId?, farmId?, applicationMethod?, constraints?, userOverrides? }
   */
  async postCalculate(req, res, next) {
    try {
      const { companyId, userId } = this._getAuth(req);

      const input = {
        ...req.body,
        companyId
      };

      const result = await this.calculationService.calculate(input, userId);

      res.status(200).json({
        success: true,
        data: result.toObject ? result.toObject() : result,
        metadata: {
          calculationVersion: result.calculationVersion,
          calculatedAt: result.calculatedAt,
          warningsCount: result.warnings?.length ?? 0
        },
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/cultivos ─────────────────────────────────────────────────

  async getCrops(req, res, next) {
    try {
      const crops = await this.calculationService.getCrops();
      res.json({
        success: true,
        data: crops.map((c) => (c.toObject ? c.toObject() : c)),
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/cultivos/:cropId/etapas ─────────────────────────────────

  async getStages(req, res, next) {
    try {
      const { cropId } = req.params;
      if (!cropId) throw new ValidationError('cropId es requerido');

      const stages = await this.calculationService.getStages(cropId);
      res.json({
        success: true,
        data: stages.map((s) => (s.toObject ? s.toObject() : s)),
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/nutrientes ──────────────────────────────────────────────

  async getNutrients(req, res, next) {
    try {
      const nutrients = await this.calculationService.getNutrients();
      res.json({
        success: true,
        data: nutrients.map((n) => (n.toObject ? n.toObject() : n)),
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/fertilizantes ───────────────────────────────────────────

  async getFertilizers(req, res, next) {
    try {
      const { companyId } = this._getAuth(req);
      const fertilizers = await this.calculationService.getFertilizers(companyId);
      res.json({
        success: true,
        data: fertilizers.map((f) => (f.toObject ? f.toObject() : f)),
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/reglas ──────────────────────────────────────────────────

  async getRules(req, res, next) {
    try {
      const { companyId } = this._getAuth(req);
      const rules = await this.calculationService.getRules(companyId);
      res.json({
        success: true,
        data: rules.map((r) => (r.toObject ? r.toObject() : r)),
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── POST /calculo/analisis-suelo ─────────────────────────────────────────

  async postSoilAnalysis(req, res, next) {
    try {
      const { companyId, userId } = this._getAuth(req);
      const result = await this.calculationService.saveSoilAnalysis(companyId, {
        ...req.body,
        userId
      });
      res.status(201).json({ success: true, data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/historial ───────────────────────────────────────────────

  async getHistory(req, res, next) {
    try {
      const { companyId } = this._getAuth(req);
      const limit = parseInt(req.query.limit ?? '20', 10);
      const offset = parseInt(req.query.offset ?? '0', 10);

      const history = await this.calculationService.getCalculationHistory(companyId, {
        limit,
        offset
      });
      res.json({ success: true, data: history, error: null });
    } catch (err) {
      next(err);
    }
  }

  // ─── GET /calculo/:calculationId ─────────────────────────────────────────

  async getCalculationDetail(req, res, next) {
    try {
      const { calculationId } = req.params;
      const { companyId } = this._getAuth(req);
      const detail = await this.calculationService.getCalculation(calculationId, companyId);
      res.json({ success: true, data: detail, error: null });
    } catch (err) {
      next(err);
    }
  }
}
