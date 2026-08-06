import { mockPlansData } from '../data/mockPlans.js';
import { supabase } from '../../../lib/supabaseClient.js';

const SIMULATED_DELAY_MS = 300;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fertilizationRepository = {
  /**
   * Consulta planes reales en Supabase fertilization_plans o mock si la tabla está vacía
   */
  async getPlans(params = {}) {
    const {
      search = '',
      status = '',
      validityStatus = '',
      page = 1,
      pageSize = 5,
    } = params;

    if (supabase) {
      try {
        let query = supabase
          .from('fertilization_plans')
          .select('*', { count: 'exact' });

        if (status) query = query.eq('status', status);
        if (validityStatus) query = query.eq('validity_status', validityStatus);
        if (search.trim()) {
          query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,lot_name.ilike.%${search}%`);
        }

        const start = (page - 1) * pageSize;
        query = query.range(start, start + pageSize - 1).order('created_at', { ascending: false });

        const { data: dbData, count, error } = await query;

        if (!error && dbData && dbData.length > 0) {
          const total = count || dbData.length;
          const totalPages = Math.max(1, Math.ceil(total / pageSize));
          const mappedData = dbData.map(p => ({
            id: p.id,
            code: p.code,
            name: p.name,
            version: p.version || 'v1.0',
            lotId: p.lote_id || 'lote-12',
            lotName: p.lot_name || 'Lote 12 - El Paraíso',
            lotArea: `${p.area_ha || 4.5} ha`,
            cropName: p.crop_name || 'Cacao',
            cropScientific: p.crop_scientific || 'Theobroma cacao',
            phenologicalStage: p.phenological_stage || 'Llenado',
            status: p.status || 'draft',
            validityStatus: p.validity_status || 'scheduled',
            budgetTotal: parseFloat(p.budget_total) || 0,
            budgetExecuted: parseFloat(p.budget_executed) || 0,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }));

          return { data: mappedData, total, page, pageSize, totalPages };
        }
      } catch (err) {
        console.warn('[Repository] Supabase query falló, usando datos locales:', err);
      }
    }

    // Fallback Mock data
    await delay(SIMULATED_DELAY_MS);
    let result = [...mockPlansData];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.lotName.toLowerCase().includes(q) ||
          p.cropName.toLowerCase().includes(q),
      );
    }

    if (status) result = result.filter((p) => p.status === status);
    if (validityStatus) result = result.filter((p) => p.validityStatus === validityStatus);

    const total = result.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const data = result.slice(start, start + pageSize);

    return { data, total, page: safePage, pageSize, totalPages };
  },

  async getPlanById(id) {
    if (supabase && !id.startsWith('plan-')) {
      try {
        const { data, error } = await supabase
          .from('fertilization_plans')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            code: data.code,
            name: data.name,
            version: data.version,
            lotName: data.lot_name,
            cropName: data.crop_name,
            status: data.status,
            budgetTotal: parseFloat(data.budget_total) || 0,
            createdAt: data.created_at,
          };
        }
      } catch (e) {
        console.warn('Error fetching plan by ID from Supabase:', e);
      }
    }
    await delay(200);
    return mockPlansData.find((p) => p.id === id) ?? null;
  },

  async createPlan(data) {
    if (supabase) {
      try {
        const { data: created, error } = await supabase
          .from('fertilization_plans')
          .insert({
            name: data.name,
            lot_name: data.lotName,
            area_ha: data.area,
            crop_name: data.cropName,
            phenological_stage: data.stage,
            soil_type: data.soilType,
            budget_total: data.totalBudget || 0,
            status: 'draft',
          })
          .select()
          .single();

        if (!error && created) {
          return {
            id: created.id,
            code: created.code,
            name: created.name,
            version: created.version || 'v1.0',
            lotName: created.lot_name,
            cropName: created.crop_name,
            status: created.status,
            createdAt: created.created_at,
          };
        }
      } catch (e) {
        console.warn('Supabase create plan error:', e);
      }
    }

    const now = new Date().toISOString();
    const newPlan = {
      ...data,
      id: `plan-${Date.now()}`,
      version: 'v1.0',
      parentPlanId: null,
      createdAt: now,
      updatedAt: now,
    };
    mockPlansData.unshift(newPlan);
    return newPlan;
  },

  async updatePlan(id, data) {
    if (supabase && !id.startsWith('plan-')) {
      await supabase.from('fertilization_plans').update(data).eq('id', id);
    }
    const idx = mockPlansData.findIndex((p) => p.id === id);
    if (idx !== -1) {
      mockPlansData[idx] = { ...mockPlansData[idx], ...data, updatedAt: new Date().toISOString() };
      return mockPlansData[idx];
    }
    return data;
  },

  async archivePlan(id) {
    if (supabase && !id.startsWith('plan-')) {
      await supabase.from('fertilization_plans').update({ status: 'archived' }).eq('id', id);
    }
    const idx = mockPlansData.findIndex((p) => p.id === id);
    if (idx !== -1) mockPlansData[idx].status = 'archived';
  },

  async deletePlan(id) {
    if (supabase && !id.startsWith('plan-')) {
      await supabase.from('fertilization_plans').delete().eq('id', id);
    }
    const idx = mockPlansData.findIndex((p) => p.id === id);
    if (idx !== -1) mockPlansData.splice(idx, 1);
  },
};
