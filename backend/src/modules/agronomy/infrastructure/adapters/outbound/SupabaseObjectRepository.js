import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

/**
 * SupabaseObjectRepository
 *
 * Repositorio de catálogos maestros (sólo lectura):
 *   - Cultivos
 *   - Estados fenológicos
 *   - Objetos de evaluación (plagas, enfermedades, malezas, etc.)
 *   - Tratamientos por ingrediente activo
 *   - Relaciones cultivo → objeto por etapa
 *
 * Estos catálogos son compartidos y reutilizados por los protocolos.
 * La escritura de catálogos se reserva para el service_role (administración).
 */
export class SupabaseObjectRepository {
  // ─── Cultivos ─────────────────────────────────────────────────────────────

  async getCultivos() {
    try {
      const { data, error } = await supabaseAdmin
        .from('cultivos')
        .select(
          'id, nombre_comun, nombre_cientifico, familia_botanica, ciclo_productivo, descripcion, foto_url, estado'
        )
        .eq('estado', 'activo')
        .order('nombre_comun', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error obteniendo catálogo de cultivos', err);
    }
  }

  // ─── Estados Fenológicos ───────────────────────────────────────────────────

  async getEstadosFenologicos(cultivoId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('estados_fenologicos')
        .select('id, nombre, descripcion, orden')
        .eq('cultivo_id', cultivoId)
        .eq('estado', 'activo')
        .order('orden', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError(
        `Error obteniendo estados fenológicos para cultivo ${cultivoId}`,
        err
      );
    }
  }

  async getTodosEstadosFenologicos() {
    try {
      const { data, error } = await supabaseAdmin
        .from('estados_fenologicos')
        .select(
          `
          id, nombre, descripcion, orden,
          cultivo:cultivo_id (id, nombre_comun)
        `
        )
        .eq('estado', 'activo')
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error obteniendo todos los estados fenológicos', err);
    }
  }

  // ─── Objetos de Evaluación ─────────────────────────────────────────────────

  /**
   * Lista todos los objetos de evaluación (catálogo global).
   * @param {string|null} categoria - Filtro opcional por categoría
   */
  async getObjetosEvaluacion(cultivoId = null, estadoFenologicoId = null) {
    try {
      // Sin filtros: catálogo global para el Wizard
      if (!cultivoId) {
        const { data, error } = await supabaseAdmin
          .from('objetos_evaluacion')
          .select(
            'id, nombre_comun, nombre_cientifico, categoria, subcategoria, descripcion, foto_url'
          )
          .eq('estado', 'activo')
          .order('nombre_comun', { ascending: true });
        if (error) throw error;
        return data || [];
      }

      // 1. Con cultivo: objetos vinculados al cultivo
      let query = supabaseAdmin
        .from('cultivo_objetos')
        .select(
          `
          relevancia,
          objeto_evaluacion:objeto_evaluacion_id (
            id, nombre_comun, nombre_cientifico, categoria,
            subcategoria, descripcion, foto_url
          )
        `
        )
        .eq('cultivo_id', cultivoId)
        .eq('activo', true);

      if (estadoFenologicoId) {
        query = query.or(
          `estado_fenologico_id.eq.${estadoFenologicoId},estado_fenologico_id.is.null`
        );
      }

      const { data, error } = await query.order('relevancia', { ascending: false });
      if (error) throw error;

      const items = (data || []).map((row) => row.objeto_evaluacion).filter((obj) => obj && obj.id);

      // 2. Obtener objetos que tengan protocolos activos para este cultivo o globales
      let protoQuery = supabaseAdmin
        .from('protocolos_evaluacion')
        .select(
          `
          objeto_evaluacion:objeto_evaluacion_id (
            id, nombre_comun, nombre_cientifico, categoria,
            subcategoria, descripcion, foto_url
          )
        `
        )
        .eq('estado', 'activo')
        .is('vigencia_hasta', null)
        .or(`cultivo_id.eq.${cultivoId},cultivo_id.is.null`);

      if (estadoFenologicoId) {
        protoQuery = protoQuery.or(
          `estado_fenologico_id.eq.${estadoFenologicoId},estado_fenologico_id.is.null`
        );
      }

      const { data: protoData, error: protoErr } = await protoQuery;
      if (!protoErr && protoData) {
        protoData.forEach((row) => {
          if (row.objeto_evaluacion && row.objeto_evaluacion.id) {
            items.push(row.objeto_evaluacion);
          }
        });
      }

      // Deduplicar objetos por id
      const uniqueMap = new Map();
      items.forEach((obj) => {
        if (!uniqueMap.has(obj.id)) {
          uniqueMap.set(obj.id, obj);
        }
      });

      const result = Array.from(uniqueMap.values());

      // Fallback a catálogo global si no hay vinculación específica de objetos para este cultivo
      if (result.length === 0) {
        const { data: globalData } = await supabaseAdmin
          .from('objetos_evaluacion')
          .select(
            'id, nombre_comun, nombre_cientifico, categoria, subcategoria, descripcion, foto_url'
          )
          .eq('estado', 'activo')
          .order('nombre_comun', { ascending: true });
        return globalData || [];
      }

      return result;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo objetos de evaluación`, err);
    }
  }

  async getObjetoById(objetoId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('objetos_evaluacion')
        .select(
          'id, nombre_comun, nombre_cientifico, categoria, subcategoria, descripcion, sintomas, foto_url'
        )
        .eq('id', objetoId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo objeto de evaluación ${objetoId}`, err);
    }
  }

  // ─── Tratamientos ──────────────────────────────────────────────────────────

  async getTratamientos(objetoEvaluacionId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('objeto_tratamientos')
        .select(
          'id, tipo_control, ingrediente_activo, codigo_frac, codigo_irac, codigo_hrac, dosis_recomendada, intervalo_dias, descripcion, precauciones'
        )
        .eq('objeto_evaluacion_id', objetoEvaluacionId)
        .eq('activo', true)
        .order('tipo_control', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError(
        `Error obteniendo tratamientos para objeto ${objetoEvaluacionId}`,
        err
      );
    }
  }

  // ─── Lote ──────────────────────────────────────────────────────────────────

  async getLoteConCultivo(loteId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('lotes')
        .select(
          `
          id, codigo_interno, nombre, cultivo, estado_fenologico,
          cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)
        `
        )
        .eq('id', loteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo lote ${loteId} con cultivo`, err);
    }
  }
}
