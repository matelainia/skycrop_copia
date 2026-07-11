import { supabase } from '../services/supabase.service';

export const machineryRepository = {
  async getAll() {
    const { data, error } = await supabase
      .from('maquinaria')
      .select('id, name, codigo_id, type')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error fetching machinery: ${error.message}`);
    }
    return data || [];
  }
};
