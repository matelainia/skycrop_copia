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
    before = null,
    after = null,
    ip = null,
    endpoint = null
  }) {
    try {
      const record = {
        usuario_id: userId || 'sistema_api',
        usuario_email: userEmail || 'sistema_api',
        company_id: companyId || null,
        accion: action,
        modulo: module,
        antes: before,
        despues: after,
        ip_address: ip,
        endpoint: endpoint
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
