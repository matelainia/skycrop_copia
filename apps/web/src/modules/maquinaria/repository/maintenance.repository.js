import { supabase } from '../../../lib/supabaseClient';

/**
 * Data Access Layer for Preventive Maintenance execution
 */
export class MaintenanceRepository {
  /**
   * Register a completed maintenance log in database via RPC transaction
   */
  async registerMaintenance({ maquinariaId, date, horometro }) {
    const { data, error } = await supabase.rpc('registrar_mantenimiento_maquinaria', {
      p_maquinaria_id: maquinariaId,
      p_date: date,
      p_horometro: Number(horometro)
    });

    if (error) {
      console.error('RPC error in registerMaintenance:', error.message);
      throw error;
    }
    return data;
  }
}

export const maintenanceRepository = new MaintenanceRepository();
export default maintenanceRepository;
