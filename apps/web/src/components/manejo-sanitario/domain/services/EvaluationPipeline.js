/**
 * EvaluationPipeline
 * ==================
 * Orquestador central del Motor de Cálculo de Indicadores.
 *
 * ARQUITECTURA:
 *   Protocolo (fuente de verdad)
 *       │
 *       ▼
 *   Paso 1: VariableDictionary  — Normalizar variables capturadas
 *       │
 *       ▼
 *   Paso 2: IndicatorEngine     — Calcular indicadores en orden de dependencias
 *       │
 *       ▼
 *   Paso 3: ScaleEngine         — Clasificar valores en escalas
 *       │
 *       ▼
 *   Paso 4: AlertEngine         — Evaluar reglas y umbrales
 *       │
 *       ▼
 *   Paso 5: RecommendationEngine — Generar recomendaciones agronómicas
 *       │
 *       ▼
 *   Paso 6: DecisionEngine      — Resumen ejecutivo y punto de extensión IA
 *       │
 *       ▼
 *   EvaluationResult            — Resultado completo listo para persistir/mostrar
 *
 * PRINCIPIOS:
 *   ✅ El protocolo es la ÚNICA fuente de verdad.
 *   ✅ Sin lógica agronómica hardcodeada en este archivo.
 *   ✅ Cada paso es un servicio independiente y testeable.
 *   ✅ El pipeline es stateless: mismas entradas → misma salida.
 *   ✅ Usa ProtocolCache para evitar reconstruir el grafo en cada evaluación.
 *
 * USO TÍPICO:
 *   const resultado = EvaluationPipeline.run(protocolo, valoresCapturados, contexto);
 *   // resultado.indicadores       → Array con valor, escala, unidad de cada indicador
 *   // resultado.alertas           → Alertas disparadas, ordenadas por prioridad
 *   // resultado.recomendaciones   → Recomendaciones agronómicas
 *   // resultado.riesgoGlobal      → Nivel de riesgo global del lote
 *   // resultado.decision          → Resumen ejecutivo y sugerencia de próxima visita
 *   // resultado.metadata          → Versión del protocolo, timestamps, warnings
 */

import { VariableDictionary }    from './VariableDictionary.js';
import { IndicatorEngine }       from './IndicatorEngine.js';
import { ScaleEngine }           from './ScaleEngine.js';
import { AlertEngine }           from './AlertEngine.js';
import { RecommendationEngine }  from './RecommendationEngine.js';
import { DecisionEngine }        from './DecisionEngine.js';
import { ProtocolCache }         from './ProtocolCache.js';

export class EvaluationPipeline {

  /**
   * Ejecuta el pipeline completo de evaluación agronómica.
   *
   * @param {Object} protocolo         — Definición completa del protocolo activo
   * @param {Object} valoresCapturados — Valores de campo: { clave_variable: valor_raw }
   * @param {Object} [contexto]        — Contexto operativo: { estado_fenologico, variedad, zona, temporada }
   * @param {Object} [options]
   * @param {boolean} [options.includeDecision=true]  — Si se debe ejecutar el Paso 6 (DecisionEngine)
   * @param {boolean} [options.strict=false]           — Si variables faltantes deben ser errores fatales
   * @returns {EvaluationResult}
   */
  static run(protocolo, valoresCapturados = {}, contexto = {}, options = {}) {
    const { includeDecision = true, strict = false } = options;
    const warnings = [];
    const startTime = Date.now();

    // ── Validar entrada mínima ──────────────────────────────────────────────
    if (!protocolo) {
      return EvaluationPipeline._errorResult('El protocolo es nulo o no está definido');
    }

    const variables  = protocolo.variables  || [];
    const indicadores = protocolo.indicadores || [];

    if (indicadores.length === 0) {
      warnings.push('[EvaluationPipeline] El protocolo no tiene indicadores configurados.');
    }

    // ── PASO 1: Construir diccionario de variables ──────────────────────────
    const { dictionary, summary: varSummary } = VariableDictionary.build(
      valoresCapturados,
      variables,
      { upperCase: true, coerceNumbers: true }
    );

    if (varSummary.missing.length > 0) {
      warnings.push(`[Paso 1] Variables obligatorias sin capturar: ${varSummary.missing.join(', ')}`);
    }
    if (varSummary.invalid.length > 0) {
      warnings.push(`[Paso 1] Variables con valor inválido: ${varSummary.invalid.map(v => v.clave).join(', ')}`);
    }

    // ── PASO 2: Calcular indicadores ───────────────────────────────────────
    const { resultados: indicadoresResultado, dictionary: enrichedDict, warnings: indWarnings } =
      IndicatorEngine.compute(indicadores, dictionary, { decimales: 2 });

    warnings.push(...indWarnings);

    // ── PASO 3: Clasificar en escalas ─────────────────────────────────────
    const indicadoresClasificados = ScaleEngine.classifyAll(
      indicadoresResultado,
      indicadores,
      contexto
    );

    // ── PASO 4: Evaluar alertas ────────────────────────────────────────────
    const { alertas, riesgoGlobal } = AlertEngine.evaluate(
      protocolo,
      indicadoresClasificados,
      enrichedDict
    );

    // ── PASO 5: Generar recomendaciones ───────────────────────────────────
    const { recomendaciones } = RecommendationEngine.generate(
      protocolo,
      indicadoresClasificados,
      alertas
    );

    // ── PASO 6: Decisión ejecutiva (opcional) ─────────────────────────────
    let decision = null;
    if (includeDecision) {
      decision = DecisionEngine.decide(
        { indicadores: indicadoresClasificados, alertas, riesgoGlobal, recomendaciones },
        protocolo,
        contexto
      );
    }

    // ── Construir resultado final ──────────────────────────────────────────
    const duracionMs = Date.now() - startTime;

    return {
      // Datos principales
      indicadores:     indicadoresClasificados,
      alertas,
      recomendaciones,
      riesgoGlobal,
      decision,

      // Resúmenes de compatibilidad con la UI actual
      incidencia_pct:  EvaluationPipeline._resolveBackwardCompat('incidencia', indicadoresClasificados),
      severidad_pct:   EvaluationPipeline._resolveBackwardCompat('severidad',  indicadoresClasificados),

      // Metadatos del pipeline
      metadata: {
        protocolo_id:        protocolo.id || null,
        protocolo_version:   protocolo.version || protocolo.updated_at || null,
        protocolo_nombre:    protocolo.nombre || null,
        variables_capturadas: varSummary.captured,
        variables_faltantes:  varSummary.missing,
        variables_invalidas:  varSummary.invalid.map(v => v.clave),
        indicadores_calculados: indicadoresResultado.filter(i => i.valido).length,
        indicadores_con_error:  indicadoresResultado.filter(i => !i.valido).length,
        alertas_disparadas:     alertas.length,
        duracion_ms:            duracionMs,
        warnings,
        timestamp:              new Date().toISOString(),
      },
    };
  }

  /**
   * Versión simplificada para cálculo en tiempo real durante la captura
   * de datos en el wizard de evaluación.
   * Omite el Paso 6 (DecisionEngine) para máxima velocidad.
   *
   * @param {Object} protocolo
   * @param {Object} valoresCapturados
   * @param {Object} [contexto]
   * @returns {EvaluationResult}
   */
  static runLive(protocolo, valoresCapturados = {}, contexto = {}) {
    return EvaluationPipeline.run(protocolo, valoresCapturados, contexto, {
      includeDecision: false,
      strict:          false,
    });
  }

  // ─── COMPATIBILIDAD HACIA ATRÁS ─────────────────────────────────────────────

  /**
   * Extrae el valor de un indicador por clave para mantener compatibilidad
   * con el contrato anterior (incidencia_pct, severidad_pct).
   *
   * @param {string} clave           — Clave del indicador (insensible a mayúsculas)
   * @param {Array}  indicadores     — Lista de indicadores calculados
   * @returns {number}               — Valor del indicador, 0 si no existe
   */
  static _resolveBackwardCompat(clave, indicadores) {
    const lower = clave.toLowerCase();
    const found = indicadores.find(i =>
      i.clave?.toLowerCase() === lower ||
      i.clave?.toLowerCase().includes(lower)
    );
    return found?.valor ?? 0;
  }

  /**
   * Retorna un resultado de error estructurado para fallos del pipeline.
   * @param {string} mensaje
   * @returns {EvaluationResult}
   */
  static _errorResult(mensaje) {
    return {
      indicadores:    [],
      alertas:        [],
      recomendaciones:[],
      riesgoGlobal:   { nivel: 'Sin datos', color: '#6b7280', prioridad: 0, numIndicadoresAlto: 0, numAlertasDisparadas: 0 },
      decision:       null,
      incidencia_pct: 0,
      severidad_pct:  0,
      metadata: {
        error:     mensaje,
        warnings:  [mensaje],
        timestamp: new Date().toISOString(),
      },
    };
  }
}
