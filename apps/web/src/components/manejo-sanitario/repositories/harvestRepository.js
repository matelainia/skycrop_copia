import { supabase } from '../services/supabase.service';

export const harvestRepository = {
  async getByLote(loteId, limit = 20) {
    const { data, error } = await supabase
      .from('planificacion_cosechas')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha_programada', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching harvest projections for lote ${loteId}: ${error.message}`);
    }
    return data || [];
  },

  async insert(dbPayload) {
    const { data, error } = await supabase
      .from('planificacion_cosechas')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Error inserting harvest projection: ${error.message}`);
    }
    return data;
  }
};

