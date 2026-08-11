import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

/**
 * SupabaseProtocolRepository
 *
 * Adaptador de infraestructura: acceso a Supabase para el módulo de Protocolos.
 *
 * Opera sobre las tablas relacionales normalizadas:
 *   protocolos_evaluacion          (cabecera)
 *   protocolo_variables            (variables de campo)
 *   protocolo_indicadores          (indicadores agronómicos calculados)
 *   protocolo_indicador_variables  (mapeo N-a-M indicador ↔ variable)
 *   protocolo_escalas              (rangos de clasificación por indicador)
 *   protocolo_umbrales             (condiciones de alerta)
 *   protocolo_reglas               (automatizaciones)
 *
 * El ProtocolService orchestra las llamadas a este repositorio.
 * El ProtocolAssembler convierte los resultados al objeto de dominio.
 */
export class SupabaseProtocolRepository {
  // ─── LISTADO (Biblioteca de Protocolos) ───────────────────────────────────

  /**
   * Lista protocolos con filtros opcionales.
   * Incluye conteos reales desde las tablas relacionales mediante subqueries.
   */
  async listProtocolos(filters = {}) {
    try {
      let query = supabaseAdmin
        .from('protocolos_evaluacion')
        .select(
          `
          id, version, estado, vigencia_desde, vigencia_hasta,
          frecuencia_dias, tamanio_muestra,
          nombre, tipo_monitoreo, unidad_muestreo, metodo_seleccion,
          created_at, updated_at, created_by, updated_by,
          objeto_evaluacion:objeto_evaluacion_id (id, nombre_comun, categoria),
          cultivo:cultivo_id (id, nombre_comun)
        `
        )
        .order('created_at', { ascending: false });

      if (filters.cultivo_id) query = query.eq('cultivo_id', filters.cultivo_id);
      if (filters.objeto_id) query = query.eq('objeto_evaluacion_id', filters.objeto_id);
      if (filters.estado) query = query.eq('estado', filters.estado);
      if (filters.created_by) query = query.eq('created_by', filters.created_by);

      const { data: protocolos, error } = await query;
      if (error) throw error;

      if (!protocolos || protocolos.length === 0) return [];

      // Enriquecer con conteos reales desde tablas relacionales
      const ids = protocolos.map((p) => p.id);
      const [varCounts, indCounts, umbCounts, reglaCounts] = await Promise.all([
        this._contarPorProtocolo('protocolo_variables', ids),
        this._contarPorProtocolo('protocolo_indicadores', ids),
        this._contarPorProtocolo('protocolo_umbrales', ids),
        this._contarPorProtocolo('protocolo_reglas', ids)
      ]);

      return protocolos.map((p) => ({
        ...p,
        num_variables: varCounts.get(p.id) || 0,
        num_indicadores: indCounts.get(p.id) || 0,
        num_umbrales: umbCounts.get(p.id) || 0,
        num_reglas: reglaCounts.get(p.id) || 0
      }));
    } catch (err) {
      throw new DatabaseError('Error listando protocolos', err);
    }
  }

  // ─── OBTENER PROTOCOLO COMPLETO (Ensamblado) ──────────────────────────────

  /**
   * Obtiene el protocolo completamente ensamblado usando la función SQL
   * get_protocolo_completo(). Retorna { cabecera, variables, umbrales, reglas }.
   */
  async getProtocoloCompleto(id) {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_protocolo_completo', { p_id: id });

      if (error) throw error;
      if (!data) throw new Error(`Protocolo ${id} no encontrado`);

      const { protocolo, variables = [], umbrales = [], reglas = [] } = data;
      return { cabecera: protocolo, variables, umbrales, reglas };
    } catch (err) {
      // Fallback si la función RPC no está disponible aún
      return this._getProtocoloCompletoFallback(id);
    }
  }

  /**
   * Fallback: 4 queries separadas si la función RPC no existe todavía.
   */
  async _getProtocoloCompletoFallback(id) {
    try {
      const [cabeceraRes, variablesRes, umbralesRes, reglasRes] = await Promise.all([
        supabaseAdmin
          .from('protocolos_evaluacion')
          .select(
            `
            id, version, estado, vigencia_desde, vigencia_hasta,
            frecuencia_dias, tamanio_muestra, metodologia,
            nombre, tipo_monitoreo, unidad_muestreo, metodo_seleccion,
            estados_fenologicos_ids, audit_comentario,
            created_at, updated_at, created_by, updated_by,
            objeto_evaluacion:objeto_evaluacion_id (id, nombre_comun, nombre_cientifico, categoria),
            cultivo:cultivo_id (id, nombre_comun, nombre_cientifico),
            estado_fenologico:estado_fenologico_id (id, nombre)
          `
          )
          .eq('id', id)
          .single(),

        supabaseAdmin.from('protocolo_variables').select('*').eq('protocolo_id', id).order('orden'),

        supabaseAdmin
          .from('protocolo_umbrales')
          .select('*')
          .eq('protocolo_id', id)
          .eq('activo', true)
          .order('orden'),

        supabaseAdmin
          .from('protocolo_reglas')
          .select('*')
          .eq('protocolo_id', id)
          .eq('activo', true)
          .order('orden')
      ]);

      if (cabeceraRes.error) throw cabeceraRes.error;

      // Enriquecer variables con sus escalas (modo legado)
      const variablesConEscalas = await this._enrichVariablesWithEscalas(variablesRes.data || []);

      // Cargar indicadores con sus escalas y mapeos de variables
      const indicadoresEnriquecidos = await this._fetchIndicadoresCompletos(id);

      return {
        cabecera: cabeceraRes.data,
        variables: variablesConEscalas,
        indicadores: indicadoresEnriquecidos,
        umbrales: umbralesRes.data || [],
        reglas: reglasRes.data || []
      };
    } catch (err) {
      throw new DatabaseError(`Error obteniendo protocolo completo ${id}`, err);
    }
  }

  /**
   * Obtiene solo la cabecera de un protocolo (para verificar estado).
   */
  async getCabecera(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('protocolos_evaluacion')
        .select('id, version, estado, objeto_evaluacion_id, cultivo_id, vigencia_desde')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo cabecera del protocolo ${id}`, err);
    }
  }

  /**
   * Obtiene historial de versiones del mismo objeto de evaluación.
   */
  async getHistorialVersiones(objetoEvaluacionId, cultivoId) {
    try {
      let query = supabaseAdmin
        .from('protocolos_evaluacion')
        .select(
          'id, version, estado, vigencia_desde, vigencia_hasta, created_by, created_at, audit_comentario'
        )
        .eq('objeto_evaluacion_id', objetoEvaluacionId)
        .order('created_at', { ascending: false });

      if (cultivoId) query = query.eq('cultivo_id', cultivoId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error obteniendo historial de versiones', err);
    }
  }

  // ─── PROTOCOLO VIGENTE (para evaluaciones de campo) ──────────────────────

  async getProtocoloVigente(objetoEvaluacionId, cultivoId, estadoFenologicoId) {
    try {
      const tryQuery = async (withCultivoId) => {
        let q = supabaseAdmin
          .from('protocolos_evaluacion')
          .select(
            'id, version, vigencia_desde, variables, frecuencia_dias, tamanio_muestra, metodologia, umbrales, reglas, unidad_muestreo, metodo_seleccion, nombre'
          )
          .eq('objeto_evaluacion_id', objetoEvaluacionId)
          .eq('estado', 'activo')
          .is('vigencia_hasta', null);

        if (withCultivoId) {
          q = q.eq('cultivo_id', withCultivoId);
        } else {
          q = q.is('cultivo_id', null);
        }

        if (estadoFenologicoId) {
          q = q.or(`estado_fenologico_id.eq.${estadoFenologicoId},estado_fenologico_id.is.null`);
        } else {
          q = q.is('estado_fenologico_id', null);
        }

        const { data, error } = await q
          .order('vigencia_desde', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data;
      };

      // Intentar con cultivo específico, luego global
      if (cultivoId) {
        const especifico = await tryQuery(cultivoId);
        if (especifico) return especifico;
      }
      return tryQuery(null);
    } catch (err) {
      throw new DatabaseError('Error obteniendo protocolo vigente', err);
    }
  }

  // ─── INSERTAR CABECERA ────────────────────────────────────────────────────

  async insertCabecera(payload) {
    try {
      const { data, error } = await supabaseAdmin
        .from('protocolos_evaluacion')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError('Error insertando cabecera del protocolo', err);
    }
  }

  // ─── ACTUALIZAR CABECERA ──────────────────────────────────────────────────

  async updateCabecera(id, payload) {
    try {
      const { data, error } = await supabaseAdmin
        .from('protocolos_evaluacion')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error actualizando protocolo ${id}`, err);
    }
  }

  // ─── INSERTAR ENTIDADES RELACIONALES ─────────────────────────────────────

  /**
   * Inserta variables y retorna un Map<clave, uuid> para usarlo en escalas.
   */
  async insertVariables(protocolo_id, variablesPayload) {
    const variableIdMap = new Map();
    if (!variablesPayload || variablesPayload.length === 0) return variableIdMap;

    try {
      const { data, error } = await supabaseAdmin
        .from('protocolo_variables')
        .insert(variablesPayload)
        .select('id, clave');

      if (error) throw error;
      (data || []).forEach((v) => variableIdMap.set(v.clave, v.id));
      return variableIdMap;
    } catch (err) {
      throw new DatabaseError('Error insertando variables del protocolo', err);
    }
  }

  async insertEscalas(protocolo_id, escalasPayload) {
    if (!escalasPayload || escalasPayload.length === 0) return;
    try {
      const { error } = await supabaseAdmin.from('protocolo_escalas').insert(escalasPayload);
      if (error) throw error;
    } catch (err) {
      throw new DatabaseError('Error insertando escalas del protocolo', err);
    }
  }

  /**
   * Inserta indicadores agronómicos y retorna un Map<clave, uuid>.
   * Las escalas de cada indicador se insertan justo después de obtener el ID.
   */
  async insertIndicadores(protocolo_id, indicadoresPayload) {
    const indicadorIdMap = new Map();
    if (!indicadoresPayload || indicadoresPayload.length === 0) return indicadorIdMap;

    try {
      // Insertar la cabecera de cada indicador (sin escalas ni mapeos)
      const rows = indicadoresPayload.map((ind, idx) => ({
        protocolo_id,
        clave: ind.clave,
        nombre: ind.nombre || ind.clave,
        descripcion: ind.descripcion || null,
        unidad: ind.unidad || null,
        decimales: ind.decimales ?? 2,
        estrategia_tipo: ind.estrategia_tipo || 'absoluto',
        configuracion: ind.configuracion || {},
        orden: ind.orden ?? idx,
        activo: ind.activo !== false
      }));

      const { data, error } = await supabaseAdmin
        .from('protocolo_indicadores')
        .insert(rows)
        .select('id, clave');

      if (error) throw error;
      (data || []).forEach((ind) => indicadorIdMap.set(ind.clave, ind.id));

      // Insertar escalas de cada indicador usando el UUID recién generado
      const todasLasEscalas = [];
      indicadoresPayload.forEach((ind) => {
        const indicadorId = indicadorIdMap.get(ind.clave);
        if (!indicadorId) return;

        (ind.escalas || []).forEach((escala, escIdx) => {
          todasLasEscalas.push({
            indicador_id: indicadorId,
            protocolo_id,
            nivel: escala.nivel || escala.nivel,
            min_val:
              escala.min != null
                ? Number(escala.min)
                : escala.min_val != null
                  ? Number(escala.min_val)
                  : null,
            max_val:
              escala.max != null
                ? Number(escala.max)
                : escala.max_val != null
                  ? Number(escala.max_val)
                  : null,
            color: escala.color || null,
            bg_color: escala.bg || escala.bg_color || null,
            contexto: escala.contexto || null,
            orden: escIdx
          });
        });
      });

      if (todasLasEscalas.length > 0) {
        const { error: escError } = await supabaseAdmin
          .from('protocolo_escalas')
          .insert(todasLasEscalas);
        if (escError) {
          console.warn(
            '[SupabaseProtocolRepository] Error insertando escalas de indicadores:',
            escError.message
          );
        }
      }

      return indicadorIdMap;
    } catch (err) {
      throw new DatabaseError('Error insertando indicadores del protocolo', err);
    }
  }

  /**
   * Inserta el mapeo N-a-M indicador ↔ variable en protocolo_indicador_variables.
   * @param {Map<string,string>} indicadorIdMap  clave_indicador → uuid
   * @param {Map<string,string>} variableIdMap   clave_variable  → uuid
   * @param {Array} indicadoresPayload           array de indicadores con variables_mapeadas
   */
  async insertIndicadorVariables(indicadorIdMap, variableIdMap, indicadoresPayload) {
    if (!indicadoresPayload || indicadoresPayload.length === 0) return;

    const rows = [];
    indicadoresPayload.forEach((ind) => {
      const indicadorId = indicadorIdMap.get(ind.clave);
      if (!indicadorId) return;

      // Extraer variables referenciadas por la configuración de la estrategia
      const variablesClave = this._extraerVariablesDeConfig(ind);
      variablesClave.forEach(({ clave, rol, alias }) => {
        const variableId = variableIdMap.get(clave);
        if (!variableId) return;
        rows.push({ indicador_id: indicadorId, variable_id: variableId, rol, alias });
      });
    });

    if (rows.length === 0) return;

    try {
      const { error } = await supabaseAdmin
        .from('protocolo_indicador_variables')
        .insert(rows)
        .select();
      if (error)
        console.warn(
          '[SupabaseProtocolRepository] Error insertando mapeos indicador-variable:',
          error.message
        );
    } catch (err) {
      console.warn('[SupabaseProtocolRepository] insertIndicadorVariables error:', err.message);
    }
  }

  async insertUmbrales(protocolo_id, umbralesPayload) {
    if (!umbralesPayload || umbralesPayload.length === 0) return;
    try {
      const { error } = await supabaseAdmin.from('protocolo_umbrales').insert(umbralesPayload);
      if (error) throw error;
    } catch (err) {
      throw new DatabaseError('Error insertando umbrales del protocolo', err);
    }
  }

  async insertReglas(protocolo_id, reglasPayload) {
    if (!reglasPayload || reglasPayload.length === 0) return;
    try {
      const { error } = await supabaseAdmin.from('protocolo_reglas').insert(reglasPayload);
      if (error) throw error;
    } catch (err) {
      throw new DatabaseError('Error insertando reglas del protocolo', err);
    }
  }

  // ─── ELIMINAR ENTIDADES RELACIONALES (para re-insertar en edición) ────────

  async deleteEntidadesRelacionales(protocolo_id) {
    try {
      // Borrar indicadores (CASCADE elimina protocolo_indicador_variables y escalas vinculadas)
      // Borrar variables (CASCADE elimina escalas vinculadas a variables)
      // Borrar umbrales y reglas en paralelo
      await Promise.all([
        supabaseAdmin.from('protocolo_indicadores').delete().eq('protocolo_id', protocolo_id),
        supabaseAdmin.from('protocolo_variables').delete().eq('protocolo_id', protocolo_id),
        supabaseAdmin.from('protocolo_umbrales').delete().eq('protocolo_id', protocolo_id),
        supabaseAdmin.from('protocolo_reglas').delete().eq('protocolo_id', protocolo_id)
      ]);
    } catch (err) {
      throw new DatabaseError(`Error eliminando entidades del protocolo ${protocolo_id}`, err);
    }
  }

  // ─── ELIMINAR PROTOCOLO COMPLETO ─────────────────────────────────────────

  async deleteProtocolo(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('protocolos_evaluacion')
        .delete()
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error eliminando protocolo ${id}`, err);
    }
  }

  // ─── RESOLVER OBJETO DE EVALUACIÓN ───────────────────────────────────────

  /**
   * Busca un objeto de evaluación por UUID o nombre, o lo crea si no existe.
   */
  async resolveObjetoEvaluacion(objetoId, nombreObj) {
    const isUuid = (v) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    if (isUuid(objetoId)) return objetoId;
    if (!nombreObj) return null;

    const nombre = nombreObj.trim();
    const { data: existing } = await supabaseAdmin
      .from('objetos_evaluacion')
      .select('id')
      .ilike('nombre_comun', nombre)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error } = await supabaseAdmin
      .from('objetos_evaluacion')
      .insert({ nombre_comun: nombre, categoria: 'Enfermedad Fúngica', estado: 'activo' })
      .select('id')
      .single();

    if (error) throw error;
    return created?.id || null;
  }

  // ─── ARCHIVAR VERSIÓN PREVIA ──────────────────────────────────────────────

  async archivarVersionPrevia(objetoId, cultivoId, updatedBy, excludeId = null) {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      let query = supabaseAdmin
        .from('protocolos_evaluacion')
        .update({
          estado: 'archivado',
          vigencia_hasta: hoy,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('objeto_evaluacion_id', objetoId)
        .eq('estado', 'activo')
        .is('vigencia_hasta', null);

      if (cultivoId) query = query.eq('cultivo_id', cultivoId);
      if (excludeId) query = query.neq('id', excludeId);

      const { error } = await query;
      if (error) throw error;
    } catch (err) {
      console.warn('[SupabaseProtocolRepository] Error archivando versión previa:', err.message);
    }
  }

  // ─── HELPERS INTERNOS ─────────────────────────────────────────────────────

  /** Obtiene conteos de una tabla relacional agrupados por protocolo_id */
  async _contarPorProtocolo(tabla, protocoloIds) {
    const map = new Map();
    if (!protocoloIds || protocoloIds.length === 0) return map;

    try {
      const { data } = await supabaseAdmin
        .from(tabla)
        .select('protocolo_id')
        .in('protocolo_id', protocoloIds);

      (data || []).forEach((row) => {
        map.set(row.protocolo_id, (map.get(row.protocolo_id) || 0) + 1);
      });
    } catch {
      // No es fatal; el listado simplemente mostrará 0
    }
    return map;
  }

  /** Enriquece un array de variables con sus escalas desde la BD */
  async _enrichVariablesWithEscalas(variables) {
    if (!variables || variables.length === 0) return [];

    const variableIds = variables.map((v) => v.id);
    const { data: escalas } = await supabaseAdmin
      .from('protocolo_escalas')
      .select('*')
      .in('variable_id', variableIds)
      .order('orden');

    const escalasPorVariable = new Map();
    (escalas || []).forEach((e) => {
      if (!escalasPorVariable.has(e.variable_id)) {
        escalasPorVariable.set(e.variable_id, []);
      }
      escalasPorVariable.get(e.variable_id).push(e);
    });

    return variables.map((v) => ({
      ...v,
      escalas: escalasPorVariable.get(v.id) || []
    }));
  }

  /**
   * Carga todos los indicadores de un protocolo junto con sus escalas
   * y sus mapeos de variables (protocolo_indicador_variables).
   * @param {string} protocolo_id
   * @returns {Promise<Array>}
   */
  async _fetchIndicadoresCompletos(protocolo_id) {
    try {
      const { data: indicadores, error: indError } = await supabaseAdmin
        .from('protocolo_indicadores')
        .select('*')
        .eq('protocolo_id', protocolo_id)
        .eq('activo', true)
        .order('orden');

      if (indError || !indicadores || indicadores.length === 0) return [];

      const indicadorIds = indicadores.map((i) => i.id);

      // Cargar escalas y mapeos de variables en paralelo
      const [escalasRes, mapeoRes] = await Promise.all([
        supabaseAdmin
          .from('protocolo_escalas')
          .select('*')
          .in('indicador_id', indicadorIds)
          .order('orden'),
        supabaseAdmin
          .from('protocolo_indicador_variables')
          .select(
            'indicador_id, variable_id, rol, alias, protocolo_variables(clave, etiqueta, tipo, unidad)'
          )
          .in('indicador_id', indicadorIds)
      ]);

      // Agrupar escalas por indicador_id
      const escalasPorIndicador = new Map();
      (escalasRes.data || []).forEach((e) => {
        if (!escalasPorIndicador.has(e.indicador_id)) {
          escalasPorIndicador.set(e.indicador_id, []);
        }
        escalasPorIndicador.get(e.indicador_id).push(e);
      });

      // Agrupar mapeos por indicador_id
      const mapeosPorIndicador = new Map();
      (mapeoRes.data || []).forEach((m) => {
        if (!mapeosPorIndicador.has(m.indicador_id)) {
          mapeosPorIndicador.set(m.indicador_id, []);
        }
        mapeosPorIndicador.get(m.indicador_id).push({
          variable_id: m.variable_id,
          variable_clave: m.protocolo_variables?.clave || m.alias,
          rol: m.rol,
          alias: m.alias
        });
      });

      return indicadores.map((ind) => ({
        ...ind,
        escalas: escalasPorIndicador.get(ind.id) || [],
        variables_mapeadas: mapeosPorIndicador.get(ind.id) || []
      }));
    } catch (err) {
      console.warn(
        '[SupabaseProtocolRepository] Error cargando indicadores completos:',
        err.message
      );
      return [];
    }
  }

  /**
   * Extrae las claves de variables referenciadas en la configuración de un indicador,
   * asignando el rol semántico correcto según la estrategia.
   * @param {{ estrategia_tipo: string, configuracion: Object }} indicador
   * @returns {Array<{ clave: string, rol: string, alias: string }>}
   */
  _extraerVariablesDeConfig(indicador) {
    const { estrategia_tipo, configuracion: cfg = {} } = indicador;
    const variables = [];

    switch (estrategia_tipo) {
      case 'absoluto':
        if (cfg.variable_fuente) {
          variables.push({
            clave: cfg.variable_fuente,
            rol: 'entrada',
            alias: cfg.variable_fuente
          });
        }
        break;

      case 'porcentaje':
        if (cfg.numerador)
          variables.push({ clave: cfg.numerador, rol: 'numerador', alias: 'numerador' });
        if (cfg.denominador)
          variables.push({ clave: cfg.denominador, rol: 'denominador', alias: 'denominador' });
        break;

      case 'promedio':
        if (cfg.total) variables.push({ clave: cfg.total, rol: 'numerador', alias: 'total' });
        if (cfg.unidades)
          variables.push({ clave: cfg.unidades, rol: 'denominador', alias: 'unidades' });
        break;

      case 'indice_ponderado':
        (cfg.niveles || []).forEach((n) => {
          if (n.variable)
            variables.push({ clave: n.variable, rol: 'ponderador', alias: `grado_${n.grado}` });
        });
        break;

      case 'formula':
        Object.entries(cfg.variables || {}).forEach(([alias, clave]) => {
          variables.push({ clave, rol: 'parametro', alias });
        });
        break;

      default:
        break;
    }

    return variables;
  }
}
