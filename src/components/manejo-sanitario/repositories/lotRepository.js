import { supabase } from '../services/supabase.service';

export const lotRepository = {
  async getAll() {
    const { data, error } = await supabase
      .from('lotes')
      .select('*')
      .order('codigo_interno', { ascending: true });
    
    if (error) {
      throw new Error(`Error fetching lotes: ${error.message}`);
    }
    return data || [];
  }
};
