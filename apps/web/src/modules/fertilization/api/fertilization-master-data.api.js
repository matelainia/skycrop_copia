import { supabase } from '../../../lib/supabaseClient.js';

// Política de datos SkyCrop: sin lotes/responsables ⇒ listas vacías.
// El usuario crea sus datos reales desde la UI; nunca se inventan.

export const fertilizationMasterDataApi = {
  /**
   * Carga los lotes de la empresa desde Supabase
   */
  async getLotes(companyId) {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('lotes')
        .select(`
          id,
          nombre,
          codigo_interno,
          area_ha,
          cultivo,
          variedad,
          estado_fenologico,
          predios:predio_id (id, nombre)
        `)
        .order('nombre', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map(l => ({
        id: l.id,
        nombre: `${l.nombre} ${l.codigo_interno ? `(${l.codigo_interno})` : ''}`.trim(),
        area_ha: l.area_ha ?? null,
        tipo_suelo: l.tipo_suelo || null,
        ph_base: l.ph_base ?? null,
        cultivo: l.cultivo || null,
        estado_fenologico: l.estado_fenologico || null,
        predio_nombre: l.predios?.nombre || null,
      }));
    } catch (err) {
      console.warn('[MasterDataAPI] Excepción cargando lotes:', err);
      return [];
    }
  },

  /**
   * Carga el personal responsable de la empresa desde Supabase
   */
  async getResponsables(companyId) {
    if (!supabase) return [];
    try {
      let queryTrab = supabase
        .from('trabajadores')
        .select('id, nombres, apellidos, rol')
        .order('nombres', { ascending: true });

      if (companyId) {
        queryTrab = queryTrab.eq('company_id', companyId);
      }

      const { data: trabData, error: trabErr } = await queryTrab;

      if (!trabErr && trabData && trabData.length > 0) {
        return trabData.map(t => ({
          id: t.id,
          name: `${t.nombres} ${t.apellidos || ''}`.trim(),
          role: t.rol || 'Responsable de Campo',
        }));
      }

      // Fallback a la tabla profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nombre, rol')
        .order('nombre', { ascending: true });

      if (profilesData && profilesData.length > 0) {
        return profilesData.map(p => ({
          id: p.id,
          name: p.nombre,
          role: p.rol || 'Agrónomo',
        }));
      }

      return [];
    } catch (err) {
      console.warn('[MasterDataAPI] Excepción cargando responsables:', err);
      return [];
    }
  },

  /**
   * Carga los productos fertilizantes almacenados en Supabase
   */
  async getProductos(companyId) {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('productos')
        .select('*')
        .order('nombre_producto', { ascending: true });

      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  },

  /**
   * Carga los análisis de suelo reales cargados en la plataforma desde Supabase
   */
  async getSoilAnalyses(companyId) {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('fertilization_observations')
        .select('id, title, content, observed_at, metadata, plan_id, company_id')
        .in('observation_type', ['soil', 'foliar_analysis'])
        .order('observed_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map(item => {
        const fecha = item.observed_at
          ? new Date(item.observed_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
          : '';
        const lab = item.metadata?.labName || item.metadata?.laboratory || '';
        const details = item.title || item.content || 'Análisis de suelo';
        return {
          id: item.id,
          label: `${fecha} ${lab ? `· ${lab} ` : ''}(${details})`.trim(),
          title: item.title,
          date: item.observed_at,
          raw: item,
        };
      });
    } catch (err) {
      console.warn('[MasterDataAPI] Excepción cargando análisis de suelo:', err);
      return [];
    }
  },
};
