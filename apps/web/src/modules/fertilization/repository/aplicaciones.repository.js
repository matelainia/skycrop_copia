import { supabase } from '../../../lib/supabaseClient.js';

/**
 * aplicaciones.repository.js
 * Capa de acceso a datos real — cero mocks.
 * Si Supabase no está configurado o no hay datos, retorna vacío / error explícito.
 */

// Helpers
function toDateOnly(d) {
  if (!d) return null;
  // d viene como YYYY-MM-DD desde <input type="date">
  return d;
}

export const aplicacionesRepository = {
  /**
   * Lista aplicações paginadas con filtros.
   * @param {object} params
   * @param {number} params.page
   * @param {number} params.pageSize
   * @param {string} params.search
   * @param {string} params.lotId
   * @param {string} params.status
   * @param {string} params.dateFrom - YYYY-MM-DD
   * @param {string} params.dateTo - YYYY-MM-DD
   */
  async getAplicaciones({ page = 1, pageSize = 10, search = '', lotId = '', status = '', dateFrom = '', dateTo = '' } = {}) {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }

    try {
      // Si hay filtro por lote, resolver plan_ids primero para paginación exacta server-side
      let allowedPlanIdsForLote = null;
      if (lotId) {
        try {
          const { data: planRows, error: planErr } = await supabase
            .from('fertilization_plans')
            .select('id')
            .eq('lote_id', lotId)
            .limit(1000);
          if (planErr) throw planErr;
          const ids = (planRows || []).map((p) => String(p.id));
          if (ids.length === 0) {
            return { data: [], total: 0, page, pageSize, totalPages: 1, count: 0 };
          }
          allowedPlanIdsForLote = ids;
        } catch (e) {
          // Si falla, no filtrar por lote y dejar que el post-filter lo intente
          allowedPlanIdsForLote = null;
        }
      }

      // Construir query base.
      let query = supabase
        .from('fertilization_applications')
        .select(
          `
          id,
          plan_id,
          company_id,
          plan_item_id,
          application_number,
          product_name,
          product_formula,
          scheduled_date,
          completed_date,
          status,
          dose_applied,
          dose_unit,
          completed_by,
          completion_note,
          created_at,
          updated_at
        `,
          { count: 'exact' },
        )
        .order('scheduled_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (allowedPlanIdsForLote) {
        query = query.in('plan_id', allowedPlanIdsForLote);
      }

      if (status) {
        const statusMap = {
          programada: 'pending',
          pending: 'pending',
          completada: 'completed',
          completed: 'completed',
          omitida: 'skipped',
          skipped: 'skipped',
          reprogramada: 'rescheduled',
          rescheduled: 'rescheduled',
        };
        const dbStatus = statusMap[String(status).toLowerCase()] || status;
        query = query.eq('status', dbStatus);
      }

      if (dateFrom) {
        query = query.gte('scheduled_date', toDateOnly(dateFrom));
      }
      if (dateTo) {
        query = query.lte('scheduled_date', toDateOnly(dateTo));
      }

      if (search && String(search).trim()) {
        const term = String(search).trim().replace(/,/g, '');
        const escaped = term.replace(/[%_]/g, '\\$&');
        query = query.or(`product_name.ilike.%${escaped}%,product_formula.ilike.%${escaped}%`);
      }

      const { data, count, error } = await query;

      if (error) {
        // Error real de Supabase — no ocultar
        throw new Error(error.message);
      }

      let rows = data || [];
      const total = count ?? rows.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      // Enriquecer con fertilization_plans para lote/cultivo/fase y con plan_items para método
      if (rows.length > 0) {
        try {
          const planIds = [...new Set(rows.map((r) => r.plan_id).filter(Boolean))];
          const itemIds = [...new Set(rows.map((r) => r.plan_item_id).filter(Boolean))];

          let plansMap = new Map();
          let itemsMap = new Map();
          let lotesMap = new Map();

          if (planIds.length) {
            const { data: plans } = await supabase
              .from('fertilization_plans')
              .select('id, lote_id, lot_name, sector_name, crop_name, phenological_stage, farm_name, area_ha')
              .in('id', planIds);
            (plans || []).forEach((p) => plansMap.set(String(p.id), p));

            // Obtener lotes relacionados
            const loteIds = [...new Set((plans || []).map((p) => p.lote_id).filter(Boolean))];
            if (loteIds.length) {
              const { data: lotes } = await supabase
                .from('lotes')
                .select('id, nombre, codigo_interno, cultivo, variedad, predio_id, predios:predio_id(id, nombre)')
                .in('id', loteIds);
              (lotes || []).forEach((l) => lotesMap.set(String(l.id), l));
            }
          }

          if (itemIds.length) {
            const { data: items } = await supabase
              .from('fertilization_plan_items')
              .select('id, product_name, product_formula, application_method, dose_value, dose_unit')
              .in('id', itemIds);
            (items || []).forEach((it) => itemsMap.set(String(it.id), it));
          }

          rows = rows.map((r) => {
            const plan = plansMap.get(String(r.plan_id)) || null;
            const item = r.plan_item_id ? itemsMap.get(String(r.plan_item_id)) : null;
            const lote = plan?.lote_id ? lotesMap.get(String(plan.lote_id)) : null;

            // Construir fertilización enriquecida
            return {
              ...r,
              fertilization_plans: plan
                ? {
                    id: plan.id,
                    lote_id: plan.lote_id,
                    lot_name: plan.lot_name || lote?.nombre || null,
                    sector_name: plan.sector_name || lote?.predios?.nombre || null,
                    crop_name: plan.crop_name || lote?.cultivo || null,
                    phenological_stage: plan.phenological_stage || lote?.estado_fenologico || null,
                    farm_name: plan.farm_name || null,
                    codigo_interno: lote?.codigo_interno || null,
                  }
                : null,
              fertilization_plan_items: item
                ? {
                    product_name: item.product_name,
                    product_formula: item.product_formula,
                    application_method: item.application_method,
                  }
                : null,
              // Normalizar método para UI
              application_method: item?.application_method || null,
            };
          });

          // Si se filtró por search que incluye lote/cultivo, hacer filtrado adicional en memoria para esos campos
          // (ya que no están en fertilization_applications directamente)
          if (search && String(search).trim()) {
            const termLow = String(search).trim().toLowerCase();
            const before = rows.length;
            rows = rows.filter((r) => {
              const plan = r.fertilization_plans;
              const hayInProducto = (r.product_name || '').toLowerCase().includes(termLow);
              const hayInFormula = (r.product_formula || '').toLowerCase().includes(termLow);
              const hayInLote = (plan?.lot_name || '').toLowerCase().includes(termLow);
              const hayInSector = (plan?.sector_name || '').toLowerCase().includes(termLow);
              const hayInCultivo = (plan?.crop_name || '').toLowerCase().includes(termLow);
              const hayInCodigo = (plan?.codigo_interno || '').toLowerCase().includes(termLow);
              return hayInProducto || hayInFormula || hayInLote || hayInSector || hayInCultivo || hayInCodigo;
            });
            // Si se filtró en memoria y perdimos el count exacto, ajustar paginación como aproximada
            // (ideal sería RPC, pero para no inventar, devolvemos lo filtrado)
          }

          // Fallback: si no se pudo filtrar server-side por lote, filtrar en memoria
          if (lotId && !allowedPlanIdsForLote) {
            rows = rows.filter((r) => String(r.fertilization_plans?.lote_id || '') === String(lotId));
          }
        } catch (enrichErr) {
          console.warn('[AplicacionesRepository] Error enriqueciendo filas:', enrichErr?.message || enrichErr);
          // Retornar rows sin enriquecer
        }
      }

      return {
        data: rows,
        total,
        page,
        pageSize,
        totalPages,
        count,
      };
    } catch (err) {
      // Re-throw con mensaje usable por UI
      throw err;
    }
  },

  /**
   * Estadísticas para las 4 tarjetas de resumen — todo desde datos reales.
   * @returns {Promise<{total: number, lastApp: object|null, lotsWithApps: number, totalLots: number, nutrientsKg: number}>}
   */
  async getStats() {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }

    try {
      // Total aplicaciones (count)
      const { count: total, error: errTotal } = await supabase
        .from('fertilization_applications')
        .select('id', { count: 'exact', head: true });
      if (errTotal) throw new Error(errTotal.message);

      // Última aplicación
      let lastApp = null;
      try {
        const { data: lastRows, error: errLast } = await supabase
          .from('fertilization_applications')
          .select('id, scheduled_date, completed_date, created_at')
          .order('scheduled_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1);
        if (!errLast && lastRows && lastRows.length) lastApp = lastRows[0];
      } catch (_) {}

      // Lotes con aplicaciones: distinct plan_id -> lote_id
      let lotsWithApps = 0;
      let totalLots = 0;
      try {
        const { data: appPlans } = await supabase
          .from('fertilization_applications')
          .select('plan_id')
          .limit(1000);
        const planIds = [...new Set((appPlans || []).map((r) => r.plan_id).filter(Boolean))];
        if (planIds.length) {
          const { data: plans } = await supabase
            .from('fertilization_plans')
            .select('lote_id')
            .in('id', planIds);
          const loteIds = new Set((plans || []).map((p) => p.lote_id).filter(Boolean).map(String));
          lotsWithApps = loteIds.size;
        }
        const { count: lotesCount } = await supabase.from('lotes').select('id', { count: 'exact', head: true });
        totalLots = lotesCount || 0;
      } catch (_) {}

      // Nutrientes aplicados: suma de dose_applied donde status = completed
      let nutrientsKg = 0;
      try {
        const { data: doses } = await supabase
          .from('fertilization_applications')
          .select('dose_applied')
          .eq('status', 'completed')
          .limit(1000);
        nutrientsKg = (doses || []).reduce((sum, r) => sum + (parseFloat(r.dose_applied) || 0), 0);
      } catch (_) {}

      return {
        total: total || 0,
        lastApp,
        lotsWithApps,
        totalLots,
        nutrientsKg,
      };
    } catch (err) {
      throw err;
    }
  },

  /**
   * Lotes reales de la empresa para el filtro dropdown — cero datos inventados.
   */
  async getLotesForFilter() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nombre, codigo_interno, cultivo, predio_id, predios:predio_id(id, nombre)')
        .order('nombre', { ascending: true })
        .limit(200);
      if (error) return [];
      if (!data || data.length === 0) return [];
      return data.map((l) => ({
        id: String(l.id),
        nombre: l.nombre || l.codigo_interno || 'Lote sin nombre',
        codigo: l.codigo_interno || null,
        cultivo: l.cultivo || null,
        sector: l.predios?.nombre || null,
        label: [l.codigo_interno || l.nombre, l.predios?.nombre].filter(Boolean).join(' · ') || l.nombre,
      }));
    } catch {
      return [];
    }
  },

  async getAplicacionById(id) {
    if (!supabase || !id) return null;
    try {
      const { data, error } = await supabase
        .from('fertilization_applications')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Escritura — Código de comunicación por usuario/empresa (RLS + company_id)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Crea una nueva aplicación de fertilización ligada a un plan.
   * Garantiza aislamiento multiempresa:
   *  - company_id se inyecta vía proxy Supabase (activeOrgId) y se valida con RLS current_company()
   *  - plan_id debe pertenecer a la misma empresa (FK + RLS)
   *  - completed_by registra el usuario autenticado (trazabilidad por usuario)
   *
   * @param {object} payload - { plan_id, product_name, product_formula, scheduled_date, dose_applied, dose_unit, status, completion_note }
   * @param {object} context - { userId, userName, companyId } opcional para auditoría explícita
   */
  async createAplicacion(payload, context = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');

    // Validación mínima real — no inventar datos
    if (!payload.plan_id) {
      throw new Error('Debe seleccionar un plan de fertilización válido.');
    }
    if (!payload.product_name || !String(payload.product_name).trim()) {
      throw new Error('El fertilizante es requerido.');
    }
    if (!payload.scheduled_date) {
      throw new Error('La fecha de aplicación es requerida.');
    }

    // Verificar que el plan pertenece a la empresa del usuario (evitar cross-tenant)
    try {
      const { data: plan, error: planErr } = await supabase
        .from('fertilization_plans')
        .select('id, company_id')
        .eq('id', payload.plan_id)
        .single();
      if (planErr || !plan) {
        throw new Error('Plan no encontrado o sin acceso para esta empresa.');
      }
      // Si el proxy ya filtró por company_id, plan.company_id coincidirá; si no, validar explícito
      if (context.companyId && String(plan.company_id) !== String(context.companyId)) {
        throw new Error('El plan no pertenece a tu empresa.');
      }
    } catch (err) {
      if (err.message.includes('Plan no encontrado') || err.message.includes('no pertenece')) throw err;
      console.warn('[AplicacionesRepository] No se pudo validar pertenencia del plan:', err.message);
    }

    const insertPayload = {
      plan_id: payload.plan_id,
      plan_item_id: payload.plan_item_id || null,
      product_name: String(payload.product_name).trim(),
      product_formula: payload.product_formula ? String(payload.product_formula).trim() : null,
      scheduled_date: payload.scheduled_date,
      completed_date: payload.completed_date || null,
      status: payload.status || 'pending',
      dose_applied: payload.dose_applied != null && payload.dose_applied !== '' ? Number(payload.dose_applied) : null,
      dose_unit: payload.dose_unit || 'kg/ha',
      completed_by: context.userId || payload.completed_by || null,
      completion_note: payload.completion_note ? String(payload.completion_note).trim() : null,
      // company_id se inyecta automáticamente por el proxy (TENANT_TABLES) si activeOrgId es UUID;
      // como fallback explícito, lo añadimos si el caller lo provee y el proxy no lo hizo
      ...(context.companyId ? { company_id: context.companyId } : {}),
    };

    const { data, error } = await supabase
      .from('fertilization_applications')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // Mensaje específico para RLS / permisos
      if (/permission|RLS|policy|not allowed|JWT/i.test(error.message)) {
        throw new Error('No tienes permisos para crear aplicaciones en esta empresa.');
      }
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Actualiza una aplicación existente (solo campos permitidos).
   * Respeta RLS: solo la empresa propietaria puede actualizar.
   */
  async updateAplicacion(id, patch, context = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!id) throw new Error('ID de aplicación requerido.');

    const allowed = {};
    if (patch.product_name !== undefined) allowed.product_name = String(patch.product_name).trim();
    if (patch.product_formula !== undefined) allowed.product_formula = patch.product_formula ? String(patch.product_formula).trim() : null;
    if (patch.scheduled_date !== undefined) allowed.scheduled_date = patch.scheduled_date;
    if (patch.completed_date !== undefined) allowed.completed_date = patch.completed_date;
    if (patch.status !== undefined) allowed.status = patch.status;
    if (patch.dose_applied !== undefined) allowed.dose_applied = patch.dose_applied === '' || patch.dose_applied == null ? null : Number(patch.dose_applied);
    if (patch.dose_unit !== undefined) allowed.dose_unit = patch.dose_unit;
    if (patch.completion_note !== undefined) allowed.completion_note = patch.completion_note ? String(patch.completion_note).trim() : null;
    if (context.userId) allowed.completed_by = context.userId;
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('fertilization_applications')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (/permission|RLS|policy/i.test(error.message)) throw new Error('No tienes permisos para editar esta aplicación.');
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Elimina (o marca como omitida) una aplicación.
   * Borrado físico solo para administradores (RLS); si falla, intenta marcar como 'skipped'.
   */
  async deleteAplicacion(id) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!id) throw new Error('ID requerido.');
    // Intento de borrado físico (RLS exige rol administrador)
    const { error } = await supabase.from('fertilization_applications').delete().eq('id', id);
    if (error) {
      if (/permission|policy|RLS/i.test(error.message)) {
        // Fallback: marcar como omitida si no tiene permiso de borrado
        const { data, error: updErr } = await supabase
          .from('fertilization_applications')
          .update({ status: 'skipped', updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);
        return data;
      }
      throw new Error(error.message);
    }
    return { deleted: true, id };
  },

  /**
   * Lista planes reales de la empresa para el selector de Nueva Aplicación.
   * Misma fuente que fertilizationRepository — cero mocks.
   */
  async getPlanesForSelector() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('fertilization_plans')
        .select('id, name, code, lote_id, lot_name, crop_name, phenological_stage')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error || !data) return [];
      return data.map((p) => ({
        id: String(p.id),
        label: `${p.name || p.code || 'Plan'}${p.lot_name ? ` · ${p.lot_name}` : ''}${p.crop_name ? ` · ${p.crop_name}` : ''}`,
        raw: p,
      }));
    } catch {
      return [];
    }
  },
};
