import { supabase } from '../services/supabase.service';

export const workerRepository = {
  async getByLote(loteId, limit = 20) {
    const { data, error } = await supabase
      .from('trabajadores')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha_ingreso', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching worker logs for lote ${loteId}: ${error.message}`);
    }
    return data || [];
  },

  async getAllActive() {
    const { data, error } = await supabase
      .from('trabajadores')
      .select('id, nombres, apellidos, rol')
      .order('nombres', { ascending: true });

    if (error) {
      throw new Error(`Error fetching active workers: ${error.message}`);
    }
    return data || [];
  }
};
