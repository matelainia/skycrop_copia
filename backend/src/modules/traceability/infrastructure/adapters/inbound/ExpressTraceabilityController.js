import { ValidationError } from '../../../../../shared/errors/AppErrors.js';
import { resolveTenant } from '../../../../../shared/middleware/authenticate.js';

/**
 * ExpressTraceabilityController — bitácora oficial del predio (solo lectura pública).
 * Política: CREATE solo vía SkyCrop Core (POST autenticado genera evento del sistema),
 * READ para el tenant, UPDATE/DELETE siempre rechazados (inmutabilidad).
 */
export class ExpressTraceabilityController {
  constructor({ listUC, getUC, createUC, verifyUC, chainUC, auditUC, summaryUC, repository }) {
    this.listUC = listUC;
    this.getUC = getUC;
    this.createUC = createUC;
    this.verifyUC = verifyUC;
    this.chainUC = chainUC;
    this.auditUC = auditUC;
    this.summaryUC = summaryUC;
    this.repository = repository;
  }

  _getTenant(req) {
    try {
      return resolveTenant(req, { fallbackCompanyId: null, fallbackUserId: null });
    } catch {
      return {
        companyId: req.tenant?.companyId || null,
        userId: req.tenant?.userId || req.auth?.userId || null,
        userName: req.auth?.email || 'Usuario'
      };
    }
  }

  list = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const result = await this.listUC.execute(companyId, req.query);
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
      const data = await this.getUC.execute(companyId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** Emisión de evento por SkyCrop Core (el backend es el único escritor). */
  create = async (req, res, next) => {
    try {
      const { companyId, userId, userName } = this._getTenant(req);
      const data = await this.createUC.execute(companyId, userId, userName, req.body);
      return res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  verify = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const data = await this.verifyUC.execute(companyId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  chain = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const { lote_id } = req.query;
      if (!lote_id) throw new ValidationError('lote_id requerido');
      const data = await this.chainUC.execute(companyId, lote_id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  audit = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const data = await this.auditUC.execute(companyId, req.params.id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  summary = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const { lote_id } = req.query;
      if (!lote_id) throw new ValidationError('lote_id requerido');
      const data = await this.summaryUC.execute(companyId, lote_id);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** Inmutabilidad explícita: cualquier intento de mutación se rechaza. */
  updateBlocked = async (_req, res) =>
    res.status(405).json({
      success: false,
      error: {
        code: 'IMMUTABLE_EVENT',
        message:
          'Evento de trazabilidad inmutable: no admite UPDATE. Genere un evento de corrección.'
      }
    });

  deleteBlocked = async (_req, res) =>
    res.status(405).json({
      success: false,
      error: {
        code: 'IMMUTABLE_EVENT',
        message: 'Evento de trazabilidad inmutable: no admite DELETE.'
      }
    });

  exportCsv = async (req, res, next) => {
    try {
      const { companyId } = this._getTenant(req);
      const result = await this.listUC.execute(companyId, { ...req.query, page: 1, limit: 1000 });
      const header = 'event_code;event_date;type;module;title;responsable;hash;source_code\n';
      const lines = (result.data || [])
        .map((e) =>
          [
            e.event_code || e.id,
            e.event_date || '',
            e.event_type || '',
            e.source_module || '',
            `"${String(e.title || '').replace(/"/g, '""')}"`,
            `"${String(e.responsable || '').replace(/"/g, '""')}"`,
            e.event_hash || 'PENDIENTE_SYNC',
            e.source_code || ''
          ].join(';')
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="trazabilidad_lote.csv"');
      return res.send(`\uFEFF${header}${lines}`);
    } catch (err) {
      next(err);
    }
  };
}
export default ExpressTraceabilityController;
