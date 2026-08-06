import { supabase } from '../../../lib/supabaseClient.js';


/**
 * Servicio API para Planes de Fertilización con Supabase Backend
 */
export const fertilizationPlansApi = {
  /**
   * Crea un nuevo plan de fertilización y sus ítems de aplicaciones en Supabase
   */
  async createPlan(planPayload) {
    if (!supabase) {
      console.warn('[FertilizationAPI] Client Supabase no configurado, operando en modo simulado.');
      return {
        id: `mock-plan-${Date.now()}`,
        code: `PF-${new Date().getFullYear()}-00${Math.floor(Math.random() * 90 + 10)}`,
        ...planPayload.general,
        ...planPayload.crop,
        budget_total: planPayload.totalBudget,
        status: 'draft',
        created_at: new Date().toISOString(),
      };
    }

    // 1. Inserción de cabecera de plan
    const { data: plan, error: planError } = await supabase
      .from('fertilization_plans')
      .insert({
        name: planPayload.general.name,
        lote_id: planPayload.general.lotId || null,
        sector_name: planPayload.general.sector || null,
        area_ha: parseFloat(planPayload.general.area) || 0,
        start_date: planPayload.general.startDate || null,
        end_date: planPayload.general.endDate || null,
        responsible_name: planPayload.general.responsibleName || 'Sebastián Díaz',

        crop_name: planPayload.crop.cropName || 'Cacao',
        crop_scientific: planPayload.crop.cropScientific || 'Theobroma cacao',
        phenological_stage: planPayload.crop.stage || 'Llenado',
        density: planPayload.crop.density ? `${planPayload.crop.density} árboles/ha` : null,
        soil_type: planPayload.crop.soilType || 'Franco-arcilloso',
        budget_total: planPayload.totalBudget || 0,

        notes: planPayload.confirmation?.observations || '',
        status: 'draft',
      })
      .select()
      .single();

    if (planError) {
      console.error('[FertilizationAPI] Error creando plan:', planError);
      throw planError;
    }

    // 2. Inserción de items / aplicaciones si existen
    if (planPayload.applications && planPayload.applications.length > 0) {
      const items = planPayload.applications.map(app => ({
        plan_id: plan.id,
        product_id: app.productId || null,
        product_name: app.productName || app.productId,
        dose: parseFloat(app.dose) || 0,
        unit: 'kg/ha',
        application_date: app.date || new Date().toISOString().slice(0, 10),
        method: app.method || 'suelo',
        cost_estimated: parseFloat(app.cost) || 0,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase
        .from('fertilization_plan_items')
        .insert(items);

      if (itemsError) {
        console.error('[FertilizationAPI] Error creando ítems de plan:', itemsError);
      }
    }

    return plan;
  },

  /**
   * Obtiene la lista paginada o filtrada de planes
   */
  async getPlans() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('fertilization_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Obtiene el detalle completo de un plan vía RPC o query relacional
   */
  async getPlanDetail(planId) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .rpc('fertilization_get_plan_detail', { p_plan_id: planId });

    if (error) {
      console.error('[FertilizationAPI] Error obteniendo detalle via RPC:', error);
      // Fallback direct query
      const { data: plan } = await supabase
        .from('fertilization_plans')
        .select('*')
        .eq('id', planId)
        .single();
      return plan;
    }

    return data;
  },

  /**
   * Actualiza el estado de una aplicación (Ej: Operario marca como realizada)
   */
  async updateApplicationStatus(applicationId, newStatus) {
    if (!supabase) return true;
    const { data, error } = await supabase
      .from('fertilization_applications')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .select();

    if (error) throw error;
    return data;
  },
};
