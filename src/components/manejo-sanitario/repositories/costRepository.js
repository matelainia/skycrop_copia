import { supabase } from '../services/supabase.service';

export const costRepository = {
  async getByLote(loteId, limit = 20) {
    const { data, error } = await supabase
      .from('costos')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching costs for lote ${loteId}: ${error.message}`);
    }
    return data || [];
  }
};
