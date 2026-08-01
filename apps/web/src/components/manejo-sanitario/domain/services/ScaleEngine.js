/**
 * ScaleEngine
 * ===========
 * Paso 3 del pipeline de evaluación.
 *
 * Responsabilidad ÚNICA:
 *   Tomar el valor calculado de cada indicador y clasificarlo
 *   en el rango de escala correcto según la configuración del protocolo.
 *
 * PRIORIDAD DE ESCALAS:
 *   1. Escalas contextuales (estado fenológico, variedad, zona, temporada)
 *   2. Escalas generales (sin contexto)
 *
 * CONTRATO:
 *   Input:  valor numérico + array de escalas del indicador + contexto opcional
 *   Output: { nivel, color, bg_color, descripcion, min, max, contextual, fuera_de_rango }
 *
 * EJEMPLO DE ESCALAS EN PROTOCOLO:
 *   escalas: [
 *     { nivel: 'Bajo',    min_val: 0,  max_val: 10, color: '#22c55e', bg_color: '#dcfce7' },
 *     { nivel: 'Medio',   min_val: 10, max_val: 30, color: '#f59e0b', bg_color: '#fef3c7' },
 *     { nivel: 'Alto',    min_val: 30, max_val: 60, color: '#ef4444', bg_color: '#fee2e2' },
 *     { nivel: 'Crítico', min_val: 60, max_val: null, color: '#7f1d1d', bg_color: '#450a0a' },
 *   ]
 */

export class ScaleEngine {

  /**
   * Clasifica un valor numérico dentro de las escalas del indicador.
   *
   * @param {number|null} valor      — Valor calculado del indicador
   * @param {Array}       escalas    — Escalas definidas en el protocolo para este indicador
   * @param {Object}      [contexto] — Contexto activo: { estado_fenologico, variedad, zona, temporada }
   * @returns {ScaleResult|null}
   */
  static classify(valor, escalas = [], contexto = {}) {
    if (valor === null || valor === undefined || !Array.isArray(escalas) || escalas.length === 0) {
      return null;
    }

    const num = parseFloat(valor);
    if (isNaN(num)) return null;

    // ── Separar escalas contextuales y generales ───────────────────────────
    const contextuales = escalas.filter(e => e.contexto && ScaleEngine._contextMatches(e.contexto, contexto));
    const generales    = escalas.filter(e => !e.contexto);

    const candidatas = contextuales.length > 0 ? contextuales : generales;
    const isContextual = contextuales.length > 0;

    // ── Buscar rango que contiene el valor ────────────────────────────────
    for (const escala of candidatas) {
      const min = ScaleEngine._parseLimit(escala.min_val ?? escala.min);
      const max = ScaleEngine._parseLimit(escala.max_val ?? escala.max);

      const cumpleMin = min === null || num >= min;
      const cumpleMax = max === null || num < max;   // Intervalos semiabiertos: [min, max)

      if (cumpleMin && cumpleMax) {
        return {
          nivel:         escala.nivel,
          color:         escala.color   || '#6b7280',
          bg_color:      escala.bg_color || '#f9fafb',
          descripcion:   escala.descripcion || null,
          min,
          max,
          contextual:    isContextual,
          fuera_de_rango: false,
        };
      }
    }

    // ── Fallback: valor fuera de todos los rangos → usar el último ─────────
    if (candidatas.length > 0) {
      const ultimo = candidatas[candidatas.length - 1];
      return {
        nivel:         ultimo.nivel,
        color:         ultimo.color   || '#6b7280',
        bg_color:      ultimo.bg_color || '#f9fafb',
        descripcion:   ultimo.descripcion || null,
        min:           null,
        max:           null,
        contextual:    isContextual,
        fuera_de_rango: true,
      };
    }

    return null;
  }

  /**
   * Clasifica todos los indicadores de una evaluación.
   *
   * @param {Array}  indicadoresResultado — Salida de IndicatorEngine.compute().resultados
   * @param {Array}  indicadoresDef       — Definición de indicadores del protocolo
   * @param {Object} [contexto]
   * @returns {IndicatorResultWithScale[]}
   */
  static classifyAll(indicadoresResultado = [], indicadoresDef = [], contexto = {}) {
    const defMap = new Map(indicadoresDef.map(i => [i.clave, i]));

    return indicadoresResultado.map(resultado => {
      const def = defMap.get(resultado.clave);
      const escalas = def?.escalas || [];
      const clasificacion = ScaleEngine.classify(resultado.valor, escalas, contexto);
      return { ...resultado, clasificacion };
    });
  }

  // ─── UTILIDADES ───────────────────────────────────────────────────────────

  /**
   * Verifica si el contexto de una escala coincide con el contexto activo.
   * Solo se validan las claves presentes en el contexto de la escala
   * (comparación parcial).
   *
   * @param {Object} contextoEscala  — Contexto definido en la escala del protocolo
   * @param {Object} contextoActivo  — Contexto de la evaluación en curso
   * @returns {boolean}
   */
  static _contextMatches(contextoEscala, contextoActivo) {
    if (!contextoEscala || !contextoActivo) return false;
    return Object.entries(contextoEscala).every(([clave, valor]) => {
      const valActivo = contextoActivo[clave];
      if (!valActivo) return false;
      return String(valActivo).toLowerCase() === String(valor).toLowerCase();
    });
  }

  /**
   * Parsea un límite de escala, retornando null si es undefined/null (sin límite).
   * @param {any} val
   * @returns {number|null}
   */
  static _parseLimit(val) {
    if (val === null || val === undefined) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  /**
   * Jerarquía de niveles de riesgo estandarizada para ScaleEngine.
   * @param {string} nivel
   * @returns {number} Valor de jerarquía (0 = sin riesgo, 4 = crítico)
   */
  static riskLevel(nivel) {
    const map = {
      'Sin riesgo': 0, 'Ninguno': 0,
      'Bajo':  1,
      'Medio': 2,
      'Alto':  3,
      'Crítico': 4, 'Critico': 4,
    };
    return map[nivel] ?? 0;
  }
}
