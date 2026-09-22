import { ValidationError } from '../../../../../shared/errors/AppErrors.js';
import { resolveTenant } from '../../../../../shared/middleware/authenticate.js';
import { assertCostsPermission } from '../../../application/CostsPermissions.js';
import eventBus from '../../../../../shared/events/eventBus.js';

/**
 * Controller Costos — DRAFT. Patrón ExpressHarvestController.
 * Escribe solo vía repository (service_role + company_id); emite
 * eventBus best-effort para trazabilidad. Nunca rompe la operación origen.
 */
export class ExpressCostsController {
  constructor({
    registerUC,
    valueUC,
    allocateUC,
    postUC,
    reverseUC,
    laborSummaryUC,
    loteSummaryUC,
    entriesUC,
    issuesUC,
    eventsUC,
    recalcUC,
    repository
  }) {
    this.registerUC = registerUC;
    this.valueUC = valueUC;
    this.allocateUC = allocateUC;
    this.postUC = postUC;
    this.reverseUC = reverseUC;
    this.laborSummaryUC = laborSummaryUC;
    this.loteSummaryUC = loteSummaryUC;
    this.entriesUC = entriesUC;
    this.issuesUC = issuesUC;
    this.eventsUC = eventsUC;
    this.recalcUC = recalcUC;
    this.repository = repository;
  }

  _getTenant(req) {
    try {
      return resolveTenant(req, { fallbackCompanyId: null, fallbackUserId: null });
    } catch {
      const companyId = req.tenant?.companyId || null;
      const userId = req.tenant?.userId || req.auth?.userId || null;
      return { companyId, userId, userName: req.auth?.email || 'Usuario' };
    }
  }

  register = async (req, res, next) => {
    try {
      const { companyId, userId, userName } = this._getTenant(req);
      const result = await this.registerUC.execute(companyId, userId, req.body);
      try {
        eventBus.emit('costs:registered', {
          companyId,
          userId,
          userName,
          event: result,
          loteId: result?.lote_id || req.body?.lote_id || null,
          predioId: result?.predio_id || req.body?.predio_id || null
        });
      } catch {
        /* evidencia best-effort */
      }
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // ── Ciclo de vida 066: valorizar → asignar → publicar → reversar ──
  value = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const data = await this.valueUC.execute(companyId, userId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  allocate = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const data = await this.allocateUC.execute(companyId, userId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  publish = async (req, res, next) => {
    try {
      const { companyId, userId, userName } = this._getTenant(req);
      const data = await this.postUC.execute(companyId, userId, req.params.id);
      try {
        eventBus.emit('costs:posted', {
          companyId,
          userId,
          userName,
          entry: data?.entries?.[0] || null,
          loteId: req.body?.lote_id || null,
          predioId: req.body?.predio_id || null
        });
      } catch {
        /* evidencia best-effort */
      }
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  reverse = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const data = await this.reverseUC.execute(companyId, userId, req.params.id, req.body);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  laborSummary = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const data = await this.laborSummaryUC.execute(companyId, userId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  loteSummary = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const data = await this.loteSummaryUC.execute(companyId, userId, req.params.id, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  predioKpis = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      await assertCostsPermission(companyId, userId, 'leer');
      const data = await this.repository.getPredioKpis(companyId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  machineryKpis = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      await assertCostsPermission(companyId, userId, 'leer');
      const data = await this.repository.getMachineryKpis(companyId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  entries = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const result = await this.entriesUC.execute(companyId, userId, req.query);
      return res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (err) {
      next(err);
    }
  };

  issues = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const result = await this.issuesUC.execute(companyId, userId, req.query);
      return res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (err) {
      next(err);
    }
  };

  events = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      const result = await this.eventsUC.execute(companyId, userId, req.query);
      return res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (err) {
      next(err);
    }
  };

  recalculate = async (req, res, next) => {
    try {
      const { companyId, userId } = this._getTenant(req);
      if (!req.body || Object.keys(req.body).length === 0)
        throw new ValidationError('Scope requerido');
      await this.recalcUC.execute(companyId, userId, req.body);
      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };
}
export default ExpressCostsController;
