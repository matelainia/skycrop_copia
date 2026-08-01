/**
 * ProtocolAssembler
 *
 * Responsabilidad: transformación bidireccional entre la estructura relacional
 * de Supabase y el objeto de dominio unificado `Protocolo`.
 *
 * En ningún lugar fuera de esta clase (ni el Wizard ni la Vista Previa) debe
 * conocer la estructura interna de las tablas.
 *
 * Dirección A → B (toDB):   objeto de dominio  → payload para Supabase
 * Dirección B → A (fromDB): filas de Supabase  → objeto de dominio
 */

export class ProtocolAssembler {
  // ─── fromDB: Supabase → Dominio ───────────────────────────────────────────

  /**
   * Ensambla el objeto de dominio completo a partir de los datos relacionales
   * devueltos por la función SQL get_protocolo_completo() o por las queries
   * del SupabaseProtocolRepository.
   *
   * @param {object} dbRow - Fila de protocolos_evaluacion (con relaciones JOIN)
   * @param {Array}  variables - Filas de protocolo_variables con sub-array escalas
   * @param {Array}  umbrales  - Filas de protocolo_umbrales
   * @param {Array}  reglas    - Filas de protocolo_reglas
   * @param {Array}  indicadores - Filas de protocolo_indicadores (con escalas y variables_mapeadas)
   * @returns {ProtocoloDominio}
   */
  static fromDB(dbRow, variables = [], umbrales = [], reglas = [], indicadores = []) {
    return {
      // ── Identificación ──────────────────────────────────────────────────
      id: dbRow.id,
      version: dbRow.version || '1.0',
      estado: dbRow.estado || 'borrador',
      vigencia_desde: dbRow.vigencia_desde,
      vigencia_hasta: dbRow.vigencia_hasta,

      // ── Información General ──────────────────────────────────────────────
      nombre: dbRow.nombre || '',
      descripcion: dbRow.metodologia || '',
      responsable: dbRow.created_by || '',
      tipo_monitoreo: dbRow.tipo_monitoreo || '',

      // ── Relaciones de Catálogo ───────────────────────────────────────────
      cultivo_id: dbRow.cultivo?.id || dbRow.cultivo_id || null,
      cultivo_nombre: dbRow.cultivo?.nombre_comun || '',
      objeto_evaluacion_id: dbRow.objeto_evaluacion?.id || dbRow.objeto_evaluacion_id || null,
      objeto_nombre: dbRow.objeto_evaluacion?.nombre_comun || dbRow.objeto_nombre || '',
      objeto_cientifico: dbRow.objeto_evaluacion?.nombre_cientifico || '',
      objeto_categoria: dbRow.objeto_evaluacion?.categoria || '',
      estado_fenologico_id: dbRow.estado_fenologico?.id || null,
      estados_fenologicos_ids: dbRow.estados_fenologicos_ids || [],

      // ── Diseño de Muestreo ───────────────────────────────────────────────
      unidad_muestreo: dbRow.unidad_muestreo || '',
      tamanio_muestra: dbRow.tamanio_muestra || null,
      frecuencia_dias: dbRow.frecuencia_dias || null,
      metodo_seleccion: dbRow.metodo_seleccion || '',

      // ── Entidades Relacionales (ya normalizadas) ─────────────────────────
      variables: ProtocolAssembler._mapVariables(variables),
      indicadores: ProtocolAssembler._mapIndicadores(indicadores),
      umbrales: ProtocolAssembler._mapUmbrales(umbrales),
      reglas: ProtocolAssembler._mapReglas(reglas),

      // ── Auditoría ────────────────────────────────────────────────────────
      audit_comentario: dbRow.audit_comentario || '',
      created_at: dbRow.created_at,
      updated_at: dbRow.updated_at,
      created_by: dbRow.created_by,
      updated_by: dbRow.updated_by
    };
  }

  /**
   * Alternativa: ensamblar directamente desde el JSON devuelto por
   * la función PostgreSQL get_protocolo_completo().
   */
  static fromDBFunction(jsonResult) {
    if (!jsonResult?.protocolo) return null;
    const { protocolo, variables = [], umbrales = [], reglas = [], indicadores = [] } = jsonResult;
    return ProtocolAssembler.fromDB(protocolo, variables, umbrales, reglas, indicadores);
  }

  /**
   * Convierte la lista de protocolos del listado (sin entidades relacionales)
   * para la tarjeta de biblioteca. Las métricas provienen de los conteos
   * de las tablas relacionales embebidos como columnas calculadas.
   */
  static fromDBList(rows) {
    return (rows || []).map((row) => ({
      id: row.id,
      version: row.version,
      estado: row.estado,
      nombre: row.nombre || row.objeto_evaluacion?.nombre_comun || 'Sin nombre',
      cultivo: row.cultivo || null,
      objeto_evaluacion: row.objeto_evaluacion || null,
      tipo_monitoreo: row.tipo_monitoreo,
      unidad_muestreo: row.unidad_muestreo,
      tamanio_muestra: row.tamanio_muestra,
      frecuencia_dias: row.frecuencia_dias,
      // Conteos reales desde BD (columnas calculadas en la query de listado)
      num_variables: row.num_variables ?? 0,
      num_indicadores: row.num_indicadores ?? 0,
      num_escalas: row.num_escalas ?? 0,
      num_umbrales: row.num_umbrales ?? 0,
      num_reglas: row.num_reglas ?? 0,
      created_by: row.created_by,
      updated_at: row.updated_at,
      created_at: row.created_at
    }));
  }

  // ─── toDB: Dominio → Supabase ─────────────────────────────────────────────

  /**
   * Construye el payload para INSERT/UPDATE en protocolos_evaluacion.
   * Las entidades relacionales (variables, umbrales, reglas) se manejan
   * por separado con _buildVariablesPayload / _buildUmbralesPayload / etc.
   */
  static toDBCabecera(domainObj, estado) {
    const isUuid = (v) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    return {
      nombre: domainObj.nombre || null,
      tipo_monitoreo: domainObj.tipo_monitoreo || null,
      objeto_evaluacion_id: isUuid(domainObj.objeto_evaluacion_id)
        ? domainObj.objeto_evaluacion_id
        : null,
      cultivo_id: isUuid(domainObj.cultivo_id) ? domainObj.cultivo_id : null,
      estado_fenologico_id: isUuid(domainObj.estado_fenologico_id)
        ? domainObj.estado_fenologico_id
        : null,
      version: domainObj.version || '1.0',
      estado: domainObj.estado || estado || 'borrador',
      vigencia_desde: domainObj.vigencia_desde || new Date().toISOString().split('T')[0],
      vigencia_hasta: domainObj.vigencia_hasta || null,
      unidad_muestreo: domainObj.unidad_muestreo || null,
      tamanio_muestra: domainObj.tamanio_muestra || null,
      frecuencia_dias: domainObj.frecuencia_dias || null,
      metodo_seleccion: domainObj.metodo_seleccion || null,
      estados_fenologicos_ids: domainObj.estados_fenologicos_ids || null,
      metodologia: domainObj.descripcion || null,
      audit_comentario: domainObj.audit_comentario || null,
      // Mantener JSONB sincronizado para compatibilidad con evaluaciones existentes
      variables: ProtocolAssembler._variablesParaJsonb(domainObj.variables),
      umbrales: ProtocolAssembler._umbralesParaJsonb(domainObj.umbrales),
      reglas: ProtocolAssembler._reglasParaJsonb(domainObj.reglas)
    };
  }

  /**
   * Payload de variables para INSERT en protocolo_variables.
   */
  static toDBVariables(protocolo_id, variables = []) {
    return variables.map((v, idx) => ({
      protocolo_id,
      clave: v.clave,
      etiqueta: v.etiqueta || v.clave,
      tipo: v.tipo || 'Texto',
      unidad: v.unidad || null,
      obligatorio: v.obligatorio !== false,
      orden: v.orden ?? idx,
      min_valor: v.min ?? v.min_valor ?? null,
      max_valor: v.max ?? v.max_valor ?? null,
      opciones: v.opciones || [],
      opciones_escala: v.opciones_escala || v.escala || []
    }));
  }

  /**
   * Payload de escalas para INSERT en protocolo_escalas.
   * `variableIdMap` es un Map<clave, uuid> de las variables recién insertadas.
   */
  static toDBEscalas(protocolo_id, variables = [], variableIdMap = new Map()) {
    const rows = [];
    variables.forEach((v) => {
      const escalas = v.escalas || [];
      const variable_id = variableIdMap.get(v.clave);
      if (!variable_id) return;
      escalas.forEach((e, idx) => {
        rows.push({
          protocolo_id,
          variable_id,
          variable_clave: v.clave,
          nivel: e.nivel || 'Bajo',
          min_val: e.min_val ?? e.min ?? null,
          max_val: e.max_val ?? e.max ?? null,
          color: e.color || '#15803d',
          bg_color: e.bg_color || e.bg || null,
          orden: idx
        });
      });
    });
    return rows;
  }

  /**
   * Payload de umbrales para INSERT en protocolo_umbrales.
   */
  static toDBUmbrales(protocolo_id, umbrales = []) {
    return umbrales.map((u, idx) => ({
      protocolo_id,
      variable_clave: u.variable_clave,
      operador: u.operador || '>',
      valor: parseFloat(u.valor) || 0,
      nivel_riesgo: u.nivel_riesgo || 'Medio',
      mensaje: u.mensaje || null,
      orden: idx
    }));
  }

  /**
   * Payload de reglas para INSERT en protocolo_reglas.
   */
  static toDBReglas(protocolo_id, reglas = []) {
    return reglas.map((r, idx) => ({
      protocolo_id,
      variable_clave: r.variable_clave,
      operador: r.operador || '>',
      valor: String(r.valor || '0'),
      accion: r.accion || 'Crear alerta',
      mensaje: r.mensaje || null,
      orden: idx
    }));
  }

  // ─── Helpers internos ─────────────────────────────────────────────────────

  static _mapIndicadores(indicadores) {
    return (indicadores || []).map((ind) => ({
      id: ind.id,
      clave: ind.clave,
      nombre: ind.nombre,
      descripcion: ind.descripcion,
      unidad: ind.unidad,
      decimales: ind.decimales ?? 2,
      estrategia_tipo: ind.estrategia_tipo || 'absoluto',
      configuracion: ind.configuracion || {},
      orden: ind.orden,
      activo: ind.activo !== false,
      escalas: (ind.escalas || []).map((e) => ({
        id: e.id,
        nivel: e.nivel,
        min_val: e.min_val,
        max_val: e.max_val,
        color: e.color,
        bg_color: e.bg_color,
        contexto: e.contexto || null,
        orden: e.orden
      })),
      variables_mapeadas: (ind.variables_mapeadas || []).map((v) => ({
        variable_id: v.variable_id,
        variable_clave: v.variable_clave || v.alias,
        rol: v.rol,
        alias: v.alias
      }))
    }));
  }

  static _mapVariables(variables) {
    return (variables || []).map((v) => ({
      id: v.id,
      clave: v.clave,
      etiqueta: v.etiqueta,
      tipo: v.tipo,
      unidad: v.unidad,
      obligatorio: v.obligatorio,
      orden: v.orden,
      min_valor: v.min_valor,
      max_valor: v.max_valor,
      opciones: v.opciones || [],
      opciones_escala: v.opciones_escala || [],
      escalas: (v.escalas || []).map((e) => ({
        id: e.id,
        nivel: e.nivel,
        min_val: e.min_val,
        max_val: e.max_val,
        color: e.color,
        bg_color: e.bg_color,
        orden: e.orden
      }))
    }));
  }

  static _mapUmbrales(umbrales) {
    return (umbrales || []).map((u) => ({
      id: u.id,
      variable_clave: u.variable_clave,
      operador: u.operador,
      valor: u.valor,
      nivel_riesgo: u.nivel_riesgo,
      mensaje: u.mensaje,
      activo: u.activo
    }));
  }

  static _mapReglas(reglas) {
    return (reglas || []).map((r) => ({
      id: r.id,
      variable_clave: r.variable_clave,
      operador: r.operador,
      valor: r.valor,
      accion: r.accion,
      mensaje: r.mensaje,
      activo: r.activo
    }));
  }

  /** Serializa las variables del dominio de vuelta al formato JSONB de compatibilidad. */
  static _variablesParaJsonb(variables = []) {
    return variables.map((v) => ({
      clave: v.clave,
      etiqueta: v.etiqueta,
      tipo: v.tipo,
      unidad: v.unidad || null,
      min: v.min_valor ?? null,
      max: v.max_valor ?? null,
      obligatorio: v.obligatorio !== false,
      opciones: v.opciones || [],
      escala: v.opciones_escala || []
    }));
  }

  static _umbralesParaJsonb(umbrales = []) {
    return umbrales.map((u) => ({
      variable_clave: u.variable_clave,
      operador: u.operador,
      valor: u.valor,
      nivel_riesgo: u.nivel_riesgo,
      mensaje: u.mensaje || ''
    }));
  }

  static _reglasParaJsonb(reglas = []) {
    return reglas.map((r) => ({
      variable_clave: r.variable_clave,
      operador: r.operador,
      valor: r.valor,
      accion: r.accion,
      mensaje: r.mensaje || ''
    }));
  }
}
