import { supabase } from '../../../lib/supabaseClient.js';

// Política de datos SkyCrop: este repositorio solo refleja Supabase.
// Sin conexión o sin datos ⇒ resultados vacíos o error explícito, jamás datos inventados.

const mapPlanRow = (p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  version: p.version || 'v1.0',
  lotId: p.lote_id || null,
  lotName: p.lot_name || null,
  lotArea: p.area_ha != null ? `${p.area_ha} ha` : null,
  cropName: p.crop_name || null,
  cropScientific: p.crop_scientific || null,
  phenologicalStage: p.phenological_stage || null,
  status: p.status || 'draft',
  validityStatus: p.validity_status || 'scheduled',
  budgetTotal: parseFloat(p.budget_total) || 0,
  budgetExecuted: parseFloat(p.budget_executed) || 0,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

export const fertilizationRepository = {
  async getPlans({ page = 1, pageSize = 10, search = '', status = '', validityStatus = '' } = {}) {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }

    try {
      let query = supabase
        .from('fertilization_plans')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (search.trim()) query = query.or(`name.ilike.%${search.trim()}%,code.ilike.%${search.trim()}%`);
      if (status) query = query.eq('status', status);
      if (validityStatus) query = query.eq('validity_status', validityStatus);

      const { data: dbData, count, error } = await query;

      if (error) {
        console.warn('[Repository] Error consultando planes:', error.message);
        return { data: [], total: 0, page, pageSize, totalPages: 1 };
      }

      const total = count || dbData?.length || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      return {
        data: (dbData || []).map(mapPlanRow),
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (err) {
      console.warn('[Repository] Excepción consultando planes:', err);
      return { data: [], total: 0, page, pageSize, totalPages: 1 };
    }
  },

  async getPlanById(id) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('fertilization_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return mapPlanRow(data);
    } catch (e) {
      console.warn('Error fetching plan by ID from Supabase:', e);
      return null;
    }
  },

  async createPlan(data) {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }

    const { data: created, error } = await supabase
      .from('fertilization_plans')
      .insert({
        name: data.name,
        lot_id: data.lotId || null,
        lot_name: data.lotName || null,
        area_ha: data.area ?? null,
        crop_name: data.cropName || null,
        phenological_stage: data.stage || null,
        soil_type: data.soilType || null,
        budget_total: data.totalBudget || 0,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`No fue posible crear el plan: ${error.message}`);
    }
    return mapPlanRow(created);
  },

  async updatePlan(id, data) {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('fertilization_plans').update(data).eq('id', id);
    if (error) {
      throw new Error(`No fue posible actualizar el plan: ${error.message}`);
    }
    return { id, ...data };
  },

  async archivePlan(id) {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase
      .from('fertilization_plans')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) {
      throw new Error(`No fue posible archivar el plan: ${error.message}`);
    }
  },

  async deletePlan(id) {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('fertilization_plans').delete().eq('id', id);
    if (error) {
      throw new Error(`No fue posible eliminar el plan: ${error.message}`);
    }
  },
};
