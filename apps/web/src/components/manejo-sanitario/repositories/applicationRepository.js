import { supabase } from '../services/supabase.service';

export const applicationRepository = {
  async getAll() {
    const { data, error } = await supabase
      .from('aplicaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching all applications: ${error.message}`);
    }
    return data || [];
  },

  async getByLote(loteId, limit = 50) {
    const { data, error } = await supabase
      .from('aplicaciones')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha_aplicacion', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching applications for lote ${loteId}: ${error.message}`);
    }
    return data || [];
  },

  async insert(dbPayload) {
    const { data, error } = await supabase
      .from('aplicaciones')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Error inserting application: ${error.message}`);
    }
    return data;
  },

  async update(appId, payload) {
    const { data, error } = await supabase
      .from('aplicaciones')
      .update(payload)
      .eq('id', appId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating application status: ${error.message}`);
    }
    return data;
  },

  async delete(appId) {
    const { data, error } = await supabase
      .from('aplicaciones')
      .delete()
      .eq('id', appId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error deleting application: ${error.message}`);
    }
    return data;
  }
};

