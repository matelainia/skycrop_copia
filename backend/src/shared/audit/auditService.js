import { supabaseAdmin } from '../database/supabase.js';
import Logger from '../observability/logger.js';

export class AuditService {
  /**
   * Registra una auditoría de cambio o acceso en la base de datos y consola.
   */
  static async log({
    userId,
    userEmail,
    companyId,
    action,
    module,
    table = null,
    recordId = null,
    before = null,
    after = null,
    ip = null,
    endpoint = null,
    metadata = null
  }) {
    try {
      // C4: respetar CHECK audit_logs.accion; company_id NOT NULL (no inventar).
      const allowed = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
      if (!allowed.includes(action)) {
        Logger.error('Accion de auditoria no valida (descartada):', { action, module });
        return;
      }
      if (!companyId) {
        Logger.error('Auditoria sin company_id (descartada, fail-closed):', { action, module });
        return;
      }
      const afterId =
        recordId ||
        (after && typeof after === 'object' && !Buffer.isBuffer(after)
          ? after.id || after.data?.id || null
          : null);
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const record = {
        usuario_id: userId || 'sistema',
        usuario_email: userEmail || userId || 'sistema',
        company_id: companyId,
        accion: action,
        modulo: module,
        tabla: table,
        registro_id: uuidRe.test(String(afterId || '')) ? afterId : null,
        antes: Buffer.isBuffer(before) ? '[BINARY]' : before,
        despues: Buffer.isBuffer(after) ? '[BINARY]' : after,
        metadata: { ...(metadata || {}), ...(endpoint ? { endpoint } : {}) },
        ip: ip
      };

      const { error } = await supabaseAdmin.from('audit_logs').insert([record]);
      if (error) throw error;

      Logger.audit(
        `[AUDIT] Action: "${action}" | Module: "${module}" | User: ${userEmail || 'N/A'}`,
        record
      );
    } catch (err) {
      Logger.error('Error guardando registro de auditoría en base de datos:', {
        error: err.message,
        action,
        module
      });
    }
  }
}

export default AuditService;
