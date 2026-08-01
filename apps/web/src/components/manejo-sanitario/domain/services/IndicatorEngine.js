/**
 * IndicatorEngine
 * ===============
 * Paso 2 del pipeline de evaluación.
 *
 * Responsabilidad:
 *   Calcular TODOS los indicadores del protocolo en el ORDEN CORRECTO
 *   determinado por el DependencyGraph, usando las estrategias registradas
 *   en el StrategyRegistry (backend) o el FormulaEngine (para expresiones libres).
 *
 * Características:
 *   ✅ Orden de cálculo basado en grafo de dependencias (evita referencias cruzadas rotas)
 *   ✅ Cada indicador calculado se añade al diccionario para que otros puedan referenciarlo
 *   ✅ Agnóstico al tipo de estrategia (delega al StrategyRegistry/FormulaEngine)
 *   ✅ Sin lógica codificada — todo viene del protocolo
 *
 * FLUJO:
 *   dictionary (variables capturadas)
 *       ↓
 *   [DependencyGraph.getSortedOrder()]
 *       ↓ (por cada indicador en orden)
 *   [StrategyRegistry.get(tipo).calculate(dictionary, config)]
 *       ↓
 *   Añadir resultado al dictionary (para indicadores dependientes)
 *       ↓
 *   Array de resultados de indicadores
 */

import { DependencyGraph } from './DependencyGraph.js';
import { FormulaEngine }   from './FormulaEngine.js';

/**
 * Interfaz interna de estrategia para el frontend.
 * El frontend no tiene acceso al StrategyRegistry del backend,
 * por lo que implementamos la resolución directamente aquí.
 *
 * Estrategias soportadas:
 *   - 'porcentaje'     → (numerador / denominador) * 100
 *   - 'absoluto'       → valor directo de la variable
 *   - 'promedio'       → AVG de las variables listadas
 *   - 'indice_ponderado' → suma ponderada de variables
 *   - 'formula'        → expresión libre evaluada con FormulaEngine
 */
const _STRATEGIES = {

  porcentaje: (dictionary, config) => {
    const numKey = (config.numerador || config.variable_numerador || config.num || '').toUpperCase();
    const denKey = (config.denominador || config.variable_denominador || config.den || '').toUpperCase();

    const findVal = (key) => {
      if (!key) return 0;
      if (dictionary[key] !== undefined && dictionary[key] !== null) return parseFloat(dictionary[key]) || 0;
      if (dictionary[key.toLowerCase()] !== undefined && dictionary[key.toLowerCase()] !== null) return parseFloat(dictionary[key.toLowerCase()]) || 0;
      return 0;
    };

    const num = findVal(numKey);
    const den = findVal(denKey);

    if (den === 0) return { valor: 0, advertencia: 'Denominador es 0; incidencia = 0%' };
    return { valor: (num / den) * 100 };
  },

  absoluto: (dictionary, config) => {
    const clave = (config.variable_clave || config.variable || '').toUpperCase();
    const val   = dictionary[clave];
    if (val === null || val === undefined) {
      return { valor: null, advertencia: `Variable "${clave}" no capturada` };
    }
    return { valor: parseFloat(val) || 0 };
  },

  promedio: (dictionary, config) => {
    const variables = config.variables || [];
    if (!variables.length) return { valor: null, error: 'No se configuraron variables para promedio' };
    const nums = variables
      .map(clave => parseFloat(dictionary[(clave || '').toUpperCase()]))
      .filter(n => !isNaN(n));
    if (!nums.length) return { valor: null, advertencia: 'Ninguna variable de promedio tiene valor capturado' };
    return { valor: nums.reduce((a, b) => a + b, 0) / nums.length };
  },

  indice_ponderado: (dictionary, config) => {
    const pesos = config.pesos || {};  // { CLAVE: peso }
    let suma = 0;
    let sumaPesos = 0;
    for (const [clave, peso] of Object.entries(pesos)) {
      const val = parseFloat(dictionary[clave.toUpperCase()]);
      if (!isNaN(val)) {
        suma += val * parseFloat(peso);
        sumaPesos += parseFloat(peso);
      }
    }
    if (sumaPesos === 0) return { valor: null, advertencia: 'Suma de pesos es 0' };
    return { valor: suma / sumaPesos };
  },

  formula: (dictionary, config) => {
    const expresion = config.expresion || config.formula || '';
    if (!expresion) return { valor: null, error: 'Expresión de fórmula no configurada' };

    // Mapear aliases → valores del diccionario
    const variables = { ...dictionary };

    // Si hay un mapa de aliases explícito, añadirlo también
    if (config.variables && typeof config.variables === 'object') {
      for (const [alias, clave] of Object.entries(config.variables)) {
        const val = dictionary[(clave || '').toUpperCase()];
        if (val !== null && val !== undefined) {
          variables[alias.toUpperCase()] = val;
          variables[alias] = val; // también en minúsculas por si acaso
        }
      }
    }

    return FormulaEngine.evaluate(expresion, variables, { decimales: 6 });
  },
};

export class IndicatorEngine {

  /**
   * Calcula todos los indicadores del protocolo respetando el orden
   * de dependencias.
   *
   * @param {Array}  indicadores  — Indicadores del protocolo (definición completa)
   * @param {Object} dictionary   — Diccionario de variables (salida de VariableDictionary.build)
   * @param {Object} [options]
   * @param {Object} [options.dependencyGraph] — Grafo pre-computado (DependencyGraph serializado); si se omite se calcula en el momento
   * @param {number} [options.decimales=2]     — Decimales de los resultados
   * @returns {{ resultados: IndicatorResult[], dictionary: Object, warnings: string[] }}
   */
  static compute(indicadores = [], dictionary = {}, options = {}) {
    const { decimales = 2 } = options;

    const resultados = [];
    const warnings   = [];
    const workingDict = { ...dictionary };

    // ── Determinar orden de cálculo ─────────────────────────────────────────

    let sortedClaves;
    try {
      const variableKeys = Object.keys(dictionary);
      const graph = DependencyGraph.build(
        indicadores.filter(i => i.activo !== false),
        variableKeys
      );
      sortedClaves = graph.getSortedOrder();
    } catch (err) {
      warnings.push(`[IndicatorEngine] Error construyendo grafo de dependencias: ${err.message}. Se calculará en orden de definición.`);
      sortedClaves = indicadores.filter(i => i.activo !== false).map(i => i.clave);
    }

    // Mapa para acceso rápido
    const indicadorMap = new Map(indicadores.map(i => [i.clave, i]));

    // ── Calcular indicadores en orden ───────────────────────────────────────

    for (const clave of sortedClaves) {
      const indicador = indicadorMap.get(clave);
      if (!indicador) continue;
      if (indicador.activo === false) continue;

      const resultado = IndicatorEngine._calcularIndicador(indicador, workingDict, decimales, warnings);
      resultados.push(resultado);

      // Añadir al diccionario para que indicadores dependientes puedan referenciarlo
      if (resultado.valor !== null) {
        workingDict[clave.toUpperCase()] = resultado.valor;
        workingDict[clave] = resultado.valor;
      }
    }

    return {
      resultados,
      dictionary: workingDict,  // diccionario enriquecido con indicadores calculados
      warnings,
    };
  }

  /**
   * Calcula un solo indicador.
   *
   * @param {Object} indicador    — Definición del indicador
   * @param {Object} dictionary   — Diccionario de variables + indicadores previos
   * @param {number} decimales
   * @param {string[]} warnings
   * @returns {IndicatorResult}
   */
  static _calcularIndicador(indicador, dictionary, decimales, warnings) {
    const tipo   = (indicador.estrategia_tipo || indicador.tipo || 'absoluto').toLowerCase();
    const config = indicador.configuracion || {};

    // Resolver estrategia
    const strategyFn = _STRATEGIES[tipo];

    let valor    = null;
    let valido   = false;
    let error    = null;
    let advertencia = null;

    if (!strategyFn) {
      error = `Estrategia "${tipo}" no reconocida en IndicatorEngine. Estrategias disponibles: ${Object.keys(_STRATEGIES).join(', ')}`;
      warnings.push(`[IndicatorEngine] ${error} — Indicador: ${indicador.clave}`);
    } else {
      try {
        const outcome = strategyFn(dictionary, config);
        valor       = outcome.valor !== undefined ? outcome.valor : null;
        error       = outcome.error || null;
        advertencia = outcome.advertencia || null;
        valido      = valor !== null && error === null;

        if (advertencia) warnings.push(`[${indicador.clave}] ${advertencia}`);
        if (error)       warnings.push(`[${indicador.clave}] ERROR: ${error}`);

        // Aplicar redondeo y límites
        if (valor !== null && !isNaN(valor)) {
          valor = parseFloat(Number(valor).toFixed(decimales));

          // Respetar límites opcionales definidos en el indicador
          if (indicador.min_val !== null && indicador.min_val !== undefined) {
            valor = Math.max(indicador.min_val, valor);
          }
          if (indicador.max_val !== null && indicador.max_val !== undefined) {
            valor = Math.min(indicador.max_val, valor);
          }
        }

      } catch (err) {
        error  = `Excepción en estrategia "${tipo}": ${err.message}`;
        valido = false;
        warnings.push(`[IndicatorEngine] ${error} — Indicador: ${indicador.clave}`);
      }
    }

    return {
      clave:      indicador.clave,
      nombre:     indicador.nombre || indicador.clave,
      unidad:     indicador.unidad || '',
      valor,
      valido,
      error,
      advertencia,
      estrategia: tipo,
    };
  }
}
