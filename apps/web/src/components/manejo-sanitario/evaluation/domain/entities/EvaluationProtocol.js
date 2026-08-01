/**
 * EvaluationProtocol
 * ==================
 * Entidad de dominio que representa un Protocolo de Evaluación completo,
 * incluyendo nombre, versión, objeto evaluado, categoría, tipo de monitoreo,
 * variables, umbrales, reglas y escalas.
 *
 * Esta entidad se utiliza para:
 *   1. Construir el formulario dinámico de captura.
 *   2. Alimentar ProtocolCalculationEngine y ProtocolRuleEngine.
 *   3. Generar el protocol_snapshot inmutable al consolidar la evaluación.
 */
export class EvaluationProtocol {
  constructor({
    // Identificación
    id                 = null,
    nombre             = '',
    version            = '1.0',
    // Tipo de monitoreo y objeto evaluado
    tipo_monitoreo     = 'Sanitario',
    objeto_evaluacion_id   = null,
    objeto_evaluacion_nombre = '',
    objeto_categoria       = '',
    // Muestreo
    tamanio_muestra    = 100,
    metodo_seleccion   = '',
    unidad_muestreo    = '',
    metodologia        = '',
    frecuencia_dias    = 14,
    // Componentes del protocolo (normalizados desde tablas relacionales)
    variables          = [],
    indicadores        = [],
    umbrales           = [],
    reglas             = [],
    // Ciclo de vida
    estado             = 'Publicado',
    vigencia_hasta     = null,
    created_at         = null
  }) {
    this.id                      = id;
    this.nombre                  = nombre;
    this.version                 = version;
    this.tipoMonitoreo           = tipo_monitoreo;
    this.objetoEvaluacionId      = objeto_evaluacion_id;
    this.objetoEvaluacionNombre  = objeto_evaluacion_nombre;
    this.objetoCategoria         = objeto_categoria;
    this.tamanioMuestra          = tamanio_muestra;
    this.metodoSeleccion         = metodo_seleccion;
    this.unidadMuestreo          = unidad_muestreo;
    this.metodologia             = metodologia;
    this.frecuenciaDias          = frecuencia_dias;
    this.variables               = variables;    // Array<ProtocolVariable>
    this.indicadores             = indicadores;  // Array<ProtocolIndicator>
    this.umbrales                = umbrales;     // Array<{ variable_clave, operador, valor, nivel_riesgo, mensaje }>
    this.reglas                  = reglas;       // Array<{ variable_clave, operador, valor, accion, mensaje }>
    this.estado                  = estado;
    this.vigenciaHasta           = vigencia_hasta;
    this.createdAt               = created_at;
  }

  /**
   * Retorna las variables obligatorias del protocolo.
   * @returns {Array}
   */
  getRequiredVariables() {
    return this.variables.filter(v => v.obligatorio !== false);
  }

  /**
   * Retorna variables filtradas por tipo de dato.
   * @param {'Número'|'Decimal'|'Escala'|'Booleano'|'Lista'|'Texto'} tipo
   * @returns {Array}
   */
  getVariablesByType(tipo) {
    return this.variables.filter(v => v.tipo === tipo);
  }

  /**
   * Serializa el protocolo como un snapshot inmutable para persistir en
   * la base de datos junto con la evaluación.
   * @returns {Object} protocol_snapshot plano para la RPC guardar_evaluacion_v2
   */
  toSnapshot() {
    return {
      protocol_id:           this.id,
      protocol_name:         this.nombre,
      protocol_version:      this.version,
      monitoring_type:       this.tipoMonitoreo,
      evaluation_object_id:  this.objetoEvaluacionId,
      evaluation_object_name: this.objetoEvaluacionNombre,
      object_category:       this.objetoCategoria,
      sampling_method:       this.metodoSeleccion,
      minimum_sample:        this.tamanioMuestra
    };
  }

  /**
   * Verifica si el protocolo tiene umbrales o reglas configurados.
   * @returns {boolean}
   */
  hasRules() {
    return (this.umbrales?.length > 0) || (this.reglas?.length > 0);
  }

  /**
   * Construye un EvaluationProtocol a partir de la respuesta de la función
   * RPC get_protocolo_completo o del endpoint GET /api/agronomy/formulario-monitoreo/:loteId.
   *
   * @param {Object} raw - Dato crudo del protocolo desde Supabase/backend
   * @param {Object} objetoData - Datos del objeto de evaluación
   * @returns {EvaluationProtocol}
   */
  static fromAPIResponse(raw, objetoData = {}) {
    if (!raw) return null;

    // Compatibilidad con estructura legada (proto.protocolo || proto directamente)
    const proto = raw.protocolo || raw;

    return new EvaluationProtocol({
      id:                        proto.id,
      nombre:                    proto.nombre || proto.name || '',
      version:                   proto.version || '1.0',
      tipo_monitoreo:            proto.tipo_monitoreo || objetoData.tipo_monitoreo || 'Sanitario',
      objeto_evaluacion_id:      proto.objeto_evaluacion_id || objetoData.id || null,
      objeto_evaluacion_nombre:  objetoData.nombre_comun || objetoData.nombre || '',
      objeto_categoria:          objetoData.categoria || proto.categoria || '',
      tamanio_muestra:           proto.tamanio_muestra || proto.tamanioMuestra || 100,
      metodo_seleccion:          proto.metodo_seleccion || proto.metodologia || '',
      unidad_muestreo:           proto.unidad_muestreo || '',
      metodologia:               proto.metodologia || '',
      frecuencia_dias:           proto.frecuencia_dias || 14,
      // Componentes normalizados (desde tablas relacionales via get_protocolo_completo)
      variables:                 raw.variables   || proto.variables   || [],
      indicadores:               raw.indicadores || proto.indicadores || [],
      umbrales:                  raw.umbrales    || proto.umbrales    || [],
      reglas:                    raw.reglas      || proto.reglas      || [],
      estado:                    proto.estado    || 'Publicado',
      vigencia_hasta:            proto.vigencia_hasta || null,
      created_at:                proto.created_at || null
    });
  }
}
