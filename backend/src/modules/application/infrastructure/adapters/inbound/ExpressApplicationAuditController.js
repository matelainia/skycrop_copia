import { ValidationError } from '../../../../../shared/errors/AppErrors.js';

export class ExpressApplicationAuditController {
  constructor(confirmHighToxicityAuditUseCase, enrichApplicationStateAuditUseCase) {
    this.confirmHighToxicityAuditUseCase = confirmHighToxicityAuditUseCase;
    this.enrichApplicationStateAuditUseCase = enrichApplicationStateAuditUseCase;
  }

  /**
   * POST /api/auditoria/alta-toxicidad (o /api/v1/auditoria/alta-toxicidad)
   */
  confirmToxicity = async (req, res, next) => {
    try {
      const {
        aplicacion_id,
        usuario_id,
        ingredientes,
        advertencia_confirmada,
        declaracion_profesional,
        geolocalizacion
      } = req.body;

      if (!aplicacion_id) {
        throw new ValidationError('aplicacion_id es requerido.');
      }

      const result = await this.confirmHighToxicityAuditUseCase.execute({
        aplicacion_id,
        usuario_id,
        ingredientes,
        advertencia_confirmada,
        declaracion_profesional,
        geolocalizacion
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/auditoria/estado-aplicacion (o /api/v1/auditoria/estado-aplicacion)
   */
  enrichState = async (req, res, _next) => {
    try {
      const { aplicacion_id } = req.body;

      if (!aplicacion_id) {
        return res.status(400).json({ error: 'aplicacion_id es requerido.' });
      }

      // Captura IP real (Vercel/Proxies/Cloudflare)
      const ipAddress =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        null;

      const userAgent = req.headers['user-agent'] || null;

      const success = await this.enrichApplicationStateAuditUseCase.execute(
        aplicacion_id,
        ipAddress,
        userAgent
      );

      return res.json({ success });
    } catch (err) {
      // Política legacy: no bloquear ni romper el flujo de UI
      console.error('[AUDITORÍA ESTADO] Excepción en controlador:', err.message);
      return res.json({ success: false, detail: err.message });
    }
  };
}

export default ExpressApplicationAuditController;
