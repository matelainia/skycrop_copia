import { AgronomyRepositoryPort } from '../../../domain/ports/AgronomyRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseAgronomyRepository extends AgronomyRepositoryPort {
  async getCultivos() {
    try {
      const { data, error } = await supabaseAdmin
        .from('cultivos')
        .select(
          'id, nombre_comun, nombre_cientifico, familia_botanica, ciclo_productivo, descripcion, foto_url'
        )
        .eq('estado', 'activo')
        .order('nombre_comun', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error obteniendo catálogo de cultivos', err);
    }
  }

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

  async getObjetosEvaluacion(cultivoId, estadoFenologicoId) {
    try {
      // Consulta: objetos que aplican a la etapa fenológica o que aplican a todas (NULL)
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
        // Incluir objetos específicos de la etapa O sin etapa definida (aplican siempre)
        query = query.or(
          `estado_fenologico_id.eq.${estadoFenologicoId},estado_fenologico_id.is.null`
        );
      } else {
        query = query.is('estado_fenologico_id', null);
      }

      const { data, error } = await query.order('relevancia', { ascending: false });
      if (error) throw error;

      // Aplanar: extraer el objeto de evaluación con su relevancia
      return (data || []).map((row) => ({
        ...row.objeto_evaluacion,
        relevancia: row.relevancia
      }));
    } catch (err) {
      throw new DatabaseError(
        `Error obteniendo objetos de evaluación para cultivo ${cultivoId}`,
        err
      );
    }
  }

  async getProtocoloVigente(objetoEvaluacionId, cultivoId, estadoFenologicoId) {
    try {
      let query = supabaseAdmin
        .from('protocolos_evaluacion')
        .select(
          'id, version, vigencia_desde, variables, frecuencia_dias, tamanio_muestra, metodologia'
        )
        .eq('objeto_evaluacion_id', objetoEvaluacionId)
        .eq('estado', 'activo')
        .is('vigencia_hasta', null); // Solo el protocolo vigente

      if (cultivoId) query = query.eq('cultivo_id', cultivoId);

      if (estadoFenologicoId) {
        query = query.or(
          `estado_fenologico_id.eq.${estadoFenologicoId},estado_fenologico_id.is.null`
        );
      } else {
        query = query.is('estado_fenologico_id', null);
      }

      // Ordenar por version descendente para obtener la más reciente
      const { data, error } = await query
        .order('vigencia_desde', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(
        `Error obteniendo protocolo vigente para objeto ${objetoEvaluacionId}`,
        err
      );
    }
  }

  async getUmbralesEconomicos(objetoEvaluacionId, cultivoId, estadoFenologicoId) {
    try {
      let query = supabaseAdmin
        .from('umbrales_economicos')
        .select(
          'id, variable_clave, operador, valor_critico, nivel_riesgo, mensaje_alerta, recomendacion_inmediata, variedad, region'
        )
        .eq('objeto_evaluacion_id', objetoEvaluacionId)
        .eq('activo', true);

      if (cultivoId) {
        query = query.or(`cultivo_id.eq.${cultivoId},cultivo_id.is.null`);
      }
      if (estadoFenologicoId) {
        query = query.or(
          `estado_fenologico_id.eq.${estadoFenologicoId},estado_fenologico_id.is.null`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError(`Error obteniendo umbrales para objeto ${objetoEvaluacionId}`, err);
    }
  }

  async getReglasAgronomicas(cultivoId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reglas_agronomicas')
        .select('id, nombre, condiciones, operador_logico, accion_tipo, accion_datos')
        .or(`cultivo_id.eq.${cultivoId},cultivo_id.is.null`)
        .eq('activo', true);
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError(`Error obteniendo reglas agronómicas para cultivo ${cultivoId}`, err);
    }
  }

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
