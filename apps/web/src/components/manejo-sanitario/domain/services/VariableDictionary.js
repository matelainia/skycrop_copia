/**
 * VariableDictionary
 * ==================
 * Paso 1 del pipeline de evaluación.
 *
 * Responsabilidad ÚNICA:
 *   Recibir los valores capturados en campo y normalizarlos en un
 *   diccionario tipado y validado que el resto del pipeline pueda consumir.
 *
 * CONTRATO DE SALIDA:
 *   Un objeto plano donde:
 *   - Las claves son STRINGS en mayúsculas (nombre canónico de la variable)
 *   - Los valores son NÚMEROS (para variables numéricas) o STRINGS (para categóricas/escala)
 *   - Las variables no capturadas tienen valor null (NO undefined)
 *
 * EJEMPLO:
 *   Input:  { mazorcas_barrenadas: '15', total_mazorcas: '60', estado_planta: 'Sano' }
 *   Output: { MAZORCAS_BARRENADAS: 15, TOTAL_MAZORCAS: 60, ESTADO_PLANTA: 'Sano' }
 */

const TIPOS_NUMERICOS = new Set(['Número', 'Decimal', 'number', 'decimal', 'integer', 'float']);

export class VariableDictionary {

  /**
   * Construye y normaliza el diccionario de variables.
   *
   * @param {Object} capturedValues  — Valores capturados en campo: { clave: valor_raw }
   * @param {Array}  variablesDef    — Definición de variables del protocolo
   * @param {Object} [options]
   * @param {boolean} [options.upperCase=true]  — Si las claves deben ser en mayúsculas
   * @param {boolean} [options.coerceNumbers=true] — Convertir strings numéricos a number
   * @returns {{ dictionary: Object, summary: Object }}
   */
  static build(capturedValues = {}, variablesDef = [], options = {}) {
    const { upperCase = true, coerceNumbers = true } = options;

    const dictionary = {};
    const summary = {
      total:     variablesDef.length,
      captured:  0,
      missing:   [],
      invalid:   [],
      warnings:  [],
    };

    // Procesar variables declaradas en el protocolo
    for (const varDef of variablesDef) {
      const rawKey = varDef.clave || varDef.key || '';
      if (!rawKey) continue;

      const canonicalKey = upperCase ? rawKey.toUpperCase() : rawKey;
      const isNumeric = TIPOS_NUMERICOS.has(varDef.tipo || varDef.type || '');
      const isRequired = varDef.obligatorio !== false;

      // Buscar el valor en los datos capturados (case-insensitive)
      const rawValue = VariableDictionary._findValue(capturedValues, rawKey);

      if (rawValue === undefined || rawValue === null || rawValue === '') {
        // Variable no capturada
        dictionary[canonicalKey] = null;
        if (isRequired) {
          summary.missing.push(rawKey);
        }
        continue;
      }

      // Variable capturada — normalizar
      if (isNumeric && coerceNumbers) {
        const num = parseFloat(rawValue);
        if (isNaN(num)) {
          dictionary[canonicalKey] = null;
          summary.invalid.push({
            clave: rawKey,
            valor: rawValue,
            razon: `No es un número válido`,
          });
        } else {
          dictionary[canonicalKey] = num;
          summary.captured++;
        }
      } else {
        // Variable categórica, de escala, o texto
        dictionary[canonicalKey] = String(rawValue);
        summary.captured++;
      }
    }

    // Incluir también valores capturados que NO están declarados en el protocolo
    // (datos adicionales: temperatura, humedad, observaciones, etc.)
    for (const [rawKey, rawValue] of Object.entries(capturedValues)) {
      const canonicalKey = upperCase ? rawKey.toUpperCase() : rawKey;
      if (!(canonicalKey in dictionary)) {
        // No declarado en el protocolo: incluir como está
        const num = parseFloat(rawValue);
        if (!isNaN(num)) {
          dictionary[canonicalKey] = num;
        } else if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
          dictionary[canonicalKey] = String(rawValue);
        }
        summary.warnings.push(`Variable "${rawKey}" no declarada en el protocolo. Se incluyó en el diccionario.`);
      }
    }

    return { dictionary, summary };
  }

  /**
   * Busca un valor en el objeto de valores capturados de forma
   * insensible a mayúsculas/minúsculas.
   *
   * @param {Object} captured
   * @param {string} key
   * @returns {any}
   */
  static _findValue(captured, key) {
    // Búsqueda exacta primero (más rápida)
    if (key in captured) return captured[key];

    // Búsqueda insensible a mayúsculas
    const lower = key.toLowerCase();
    const upper = key.toUpperCase();
    if (lower in captured) return captured[lower];
    if (upper in captured) return captured[upper];

    // Búsqueda de snake_case vs camelCase básica
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (camel in captured) return captured[camel];

    return undefined;
  }

  /**
   * Combina dos diccionarios. Los valores del segundo sobreescriben al primero.
   * Útil para fusionar variables capturadas con indicadores ya calculados
   * (los indicadores calculados se añaden al diccionario para que los indicadores
   *  dependientes puedan acceder a ellos).
   *
   * @param {Object} base
   * @param {Object} override
   * @returns {Object}
   */
  static merge(base, override) {
    return { ...base, ...override };
  }

  /**
   * Verifica si una clave de variable es una referencia a un indicador
   * calculado previamente (para separar variables de indicadores).
   *
   * @param {string} clave
   * @param {string[]} indicadorClaves
   * @returns {boolean}
   */
  static isIndicatorRef(clave, indicadorClaves = []) {
    const upper = String(clave).toUpperCase();
    return indicadorClaves.some(k => k.toUpperCase() === upper);
  }
}
