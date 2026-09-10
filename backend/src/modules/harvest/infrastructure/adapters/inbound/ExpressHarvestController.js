import { ValidationError } from '../../../../../shared/errors/AppErrors.js';
import { resolveTenant } from '../../../../../shared/middleware/authenticate.js';
import eventBus from '../../../../../shared/events/eventBus.js';

export class ExpressHarvestController {
  constructor(createHarvestUC, listHarvestsUC, dashboardUC, repository) {
    this.createHarvestUC = createHarvestUC;
    this.listHarvestsUC = listHarvestsUC;
    this.dashboardUC = dashboardUC;
    this.repository = repository;
  }

  _getTenant(req) {
    try {
      return resolveTenant(req, { fallbackCompanyId: null, fallbackUserId: null });
    } catch {
      const companyId = req.tenant?.companyId || req.auth?.companyId || null;
      const userId = req.tenant?.userId || req.auth?.userId || null;
      return { companyId, userId, userName: req.auth?.email || 'Usuario' };
    }
  }

  create = async (req, res, next) => {
    try {
      const { companyId, userId, userName } = this._getTenant(req);
      const result = await this.createHarvestUC.execute(companyId, userId, req.body);
      // SkyCrop Core: generar evidencia inmutable sin mutar el registro origen.
      try {
        eventBus.emit('harvest:created', {
          companyId,
          userId,
          userName,
          harvest: { ...(result || {}), ...req.body },
          loteId: req.body?.lote_agricola_id || result?.lote_id || null,
          predioId: req.body?.predio_id || result?.predio_id || null
        });
      } catch {
        /* evidencia best-effort: nunca rompe la cosecha */
      }
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  list = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const result = await this.listHarvestsUC.execute(companyId, req.query);
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

  getById = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const data = await this.repository.getHarvestById(companyId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  dashboard = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const data = await this.dashboardUC.execute(companyId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const data = await this.repository.updateHarvest(companyId, req.params.id, req.body);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      await this.repository.deleteHarvest(companyId, req.params.id);
      return res.json({ success: true, message: 'Cosecha anulada' });
    } catch (err) {
      next(err);
    }
  };

  trazabilidad = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const { codigo } = req.query;
      if (!codigo) throw new ValidationError('codigo requerido');
      const data = await this.repository.trazabilidadPorCodigo(companyId, codigo);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
export default ExpressHarvestController;
