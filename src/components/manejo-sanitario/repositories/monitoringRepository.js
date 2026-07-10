import { supabase } from '../services/supabase.service';

export const monitoringRepository = {
  async getByLote(loteId, limit = 50) {
    const { data, error } = await supabase
      .from('monitoreos')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha_monitoreo', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching monitoreos for lote ${loteId}: ${error.message}`);
    }
    return data || [];
  }
};
