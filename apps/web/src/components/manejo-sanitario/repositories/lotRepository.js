import { supabase } from '../services/supabase.service';

export const lotRepository = {
  async getAll() {
    const { data, error } = await supabase
      .from('lotes')
      .select('*, cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)')
      .order('codigo_interno', { ascending: true });
    
    if (error) {
      throw new Error(`Error fetching lotes: ${error.message}`);
    }
    return data || [];
  },

  async create(dbPayload) {
    const { data, error } = await supabase
      .from('lotes')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Error inserting lote: ${error.message}`);
    }
    return data;
  },

  async delete(id) {
    const { data, error } = await supabase
      .from('lotes')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error deleting lote: ${error.message}`);
    }
    return data;
  }
};
