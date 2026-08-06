import { supabase } from '../../../lib/supabaseClient.js';

const DEFAULT_LOTES = [
  { id: 'lote-12', nombre: 'Lote 12 - El Paraíso', area_ha: 4.5, tipo_suelo: 'Franco-arcilloso', ph_base: 6.4 },
  { id: 'lote-05', nombre: 'Lote 05 - La Esperanza', area_ha: 3.2, tipo_suelo: 'Franco-arenoso', ph_base: 6.1 },
  { id: 'lote-08', nombre: 'Lote 08 - San José', area_ha: 5.0, tipo_suelo: 'Arcilloso', ph_base: 5.8 },
];

const DEFAULT_RESPONSABLES = [
  { id: 'seb-diaz', name: 'Sebastián Díaz', role: 'Administrador' },
  { id: 'juan-perez', name: 'Juan Pérez', role: 'Agrónomo' },
  { id: 'maria-gomez', name: 'María Gómez', role: 'Supervisora' },
];

export const fertilizationMasterDataApi = {
  /**
   * Carga los lotes de la empresa desde Supabase
   */
  async getLotes(companyId) {
    if (!supabase) return DEFAULT_LOTES;
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
        console.info('[MasterDataAPI] Usando lotes por defecto (Supabase sin lotes o error):', error?.message);
        return DEFAULT_LOTES;
      }

      return data.map(l => ({
        id: l.id,
        nombre: `${l.nombre} ${l.codigo_interno ? `(${l.codigo_interno})` : ''}`.trim(),
        area_ha: l.area_ha || 4.5,
        tipo_suelo: 'Franco-arcilloso',
        ph_base: 6.4,
        cultivo: l.cultivo || 'Cacao',
        estado_fenologico: l.estado_fenologico || 'Llenado',
        predio_nombre: l.predios?.nombre || 'Sector Norte',
      }));
    } catch (err) {
      console.warn('[MasterDataAPI] Excepción cargando lotes:', err);
      return DEFAULT_LOTES;
    }
  },

  /**
   * Carga el personal responsable de la empresa desde Supabase
   */
  async getResponsables(companyId) {
    if (!supabase) return DEFAULT_RESPONSABLES;
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

      return DEFAULT_RESPONSABLES;
    } catch (err) {
      console.warn('[MasterDataAPI] Excepción cargando responsables:', err);
      return DEFAULT_RESPONSABLES;
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
          label: `${fecha} ${lab ? `– ${lab} ` : ''}(${details})`.trim(),
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

