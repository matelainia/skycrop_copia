import { supabase } from '../../../lib/supabaseClient';
import { Operation } from '../types/Operation';

/**
 * Data Access Layer for Machinery Operations / Work Journeys (Jornadas)
 */
export class OperationRepository {
  /**
   * Fetch operations history
   */
  async getAll() {
    const { data, error } = await supabase
      .from('jornadas_maquinaria')
      .select('*, maquinaria(*)')
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Database error fetching operations:', error.message);
      throw error;
    }
    return (data || []).map(Operation.fromDatabase);
  }

  /**
   * Start a machinery operation transactionally via DB RPC
   */
  async startLabor({ maquinariaId, operator, lot, activity, startTime, startHorometro, startFuel }) {
    const { data, error } = await supabase.rpc('iniciar_labor_maquinaria', {
      p_maquinaria_id: maquinariaId,
      p_operator: operator,
      p_lot: lot,
      p_activity: activity,
      p_start_time: startTime,
      p_start_horometro: Number(startHorometro),
      p_start_fuel: Number(startFuel)
    });

    if (error) {
      console.error('RPC error in startLabor:', error.message);
      throw error;
    }
    return data;
  }

  /**
   * End a machinery operation transactionally via DB RPC
   */
  async endLabor({ jornadaId, endTime, endHorometro, endFuel, notes }) {
    const { data, error } = await supabase.rpc('finalizar_labor_maquinaria', {
      p_jornada_id: jornadaId,
      p_end_time: endTime,
      p_end_horometro: Number(endHorometro),
      p_end_fuel: Number(endFuel),
      p_notes: notes || ''
    });

    if (error) {
      console.error('RPC error in endLabor:', error.message);
      throw error;
    }
    return data;
  }
}

export const operationRepository = new OperationRepository();
export default operationRepository;
