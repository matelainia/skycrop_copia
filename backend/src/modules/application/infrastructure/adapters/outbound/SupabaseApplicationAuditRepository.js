import { ApplicationAuditRepositoryPort } from '../../../domain/ports/ApplicationAuditRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseApplicationAuditRepository extends ApplicationAuditRepositoryPort {
  async saveHighToxicityConfirmation(confirmation) {
    try {
      const { data, error } = await supabaseAdmin
        .from('auditoria_prescripcion_alta_toxicidad')
        .insert([
          {
            aplicacion_id: confirmation.aplicacion_id,
            usuario_id: confirmation.usuario_id || 'anonimo',
            ingredientes: confirmation.ingredientes,
            advertencia_confirmada: confirmation.advertencia_confirmada,
            declaracion_profesional: confirmation.declaracion_profesional,
            geolocalizacion: confirmation.geolocalizacion || null,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError('Error guardando confirmación de toxicidad en base de datos', err);
    }
  }

  async completeStateAudit(applicationId, ipAddress, userAgent) {
    try {
      const { error } = await supabaseAdmin.rpc('rpc_completar_auditoria', {
        p_aplicacion_id: applicationId,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

      if (error) throw error;
      return true;
    } catch (err) {
      throw new DatabaseError(
        `Error al enriquecer la auditoría para la aplicación ${applicationId}`,
        err
      );
    }
  }
}

export default SupabaseApplicationAuditRepository;
