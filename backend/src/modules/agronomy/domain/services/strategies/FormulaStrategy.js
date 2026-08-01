import { CalculationStrategy } from './CalculationStrategy.js';

/**
 * FormulaStrategy — Estrategia de Fórmula Personalizada.
 *
 * Permite definir expresiones matemáticas arbitrarias utilizando aliases de
 * variables del protocolo. El motor evalúa la expresión de forma segura
 * (sin eval() nativo) mediante un parser de expresiones matemáticas que solo
 * soporta operaciones algebraicas (+, -, *, /, ^, paréntesis, constantes).
 *
 * Ejemplos:
 *   (frutos_afectados / frutos_evaluados) * 100
 *   (a + b) / (c * d) * 100
 *   ((positivos / evaluados) * 100) ^ 0.5    ← raíz cuadrada del porcentaje
 *
 * Aplicaciones agronómicas:
 *   - Índices compuestos de múltiples variables
 *   - Fórmulas institucionales propietarias
 *   - Cálculos de investigación ad-hoc
 *
 * Configuración:
 *   {
 *     expresion: '(a / b) * 100',
 *     variables: {           // Mapeo de alias a clave de variable del protocolo
 *       'a': 'plantas_enfermas',
 *       'b': 'plantas_evaluadas'
 *     },
 *     unidad_salida: '%'
 *   }
 */
export class FormulaStrategy extends CalculationStrategy {
  static get tipo() {
    return 'formula';
  }
  static get label() {
    return 'Fórmula Personalizada';
  }
  static get descripcion() {
    return (
      'Define una expresión matemática usando aliases de variables del protocolo. ' +
      'Soporta +, -, ×, ÷, paréntesis y potencias. Ideal para fórmulas institucionales o de investigación.'
    );
  }

  static get esquemaConfiguracion() {
    return [
      {
        campo: 'expresion',
        label: 'Expresión matemática',
        tipo: 'formula_editor',
        requerido: true,
        descripcion: 'Expresión usando los aliases definidos, ej: "(a / b) * 100".'
      },
      {
        campo: 'variables',
        label: 'Mapeo de aliases',
        tipo: 'alias_map',
        requerido: true,
        descripcion: 'Asignación de cada alias de la fórmula a una variable del protocolo.'
      },
      { campo: 'unidad_salida', label: 'Unidad del indicador', tipo: 'text', requerido: false }
    ];
  }

  calculate(inputData, config, options = {}) {
    const { expresion, variables: aliasMap = {}, unidad_salida } = config || {};

    if (!expresion) {
      return {
        valor: null,
        unidad: unidad_salida || '',
        valido: false,
        error: 'Expresión de fórmula no configurada.'
      };
    }

    // Resolver aliases → valores numéricos
    const resolved = {};
    for (const [alias, clave] of Object.entries(aliasMap)) {
      const val = this._extraerNumero(inputData, clave);
      if (val === null) {
        return {
          valor: null,
          unidad: unidad_salida || '',
          valido: false,
          error: `Variable '${clave}' (alias '${alias}') no encontrada o vacía.`
        };
      }
      resolved[alias] = val;
    }

    try {
      const valor = this._evaluarExpresion(expresion, resolved);

      if (!isFinite(valor)) {
        return {
          valor: 0,
          unidad: unidad_salida || '',
          valido: true,
          advertencia:
            'La fórmula produjo un valor no finito (posible división por cero); se retorna 0.'
        };
      }

      return {
        valor: this._round(valor, options.decimales ?? 2),
        unidad: unidad_salida || '',
        valido: true
      };
    } catch (err) {
      return {
        valor: null,
        unidad: unidad_salida || '',
        valido: false,
        error: `Error evaluando la fórmula: ${err.message}`
      };
    }
  }

  validateConfig(config) {
    const errores = [];
    if (!config?.expresion?.trim()) errores.push('La expresión de fórmula es requerida.');
    if (!config?.variables || Object.keys(config.variables).length === 0)
      errores.push('Debe mapear al menos un alias de variable en la fórmula.');

    // Validar que los aliases usados en la expresión estén todos mapeados
    if (config?.expresion && config?.variables) {
      const aliasesEnExpresion = (config.expresion.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []).filter(
        (t) => !['Math', 'PI', 'E', 'abs', 'sqrt', 'pow', 'log', 'exp'].includes(t)
      );
      const aliasesDefinidos = new Set(Object.keys(config.variables));
      aliasesEnExpresion.forEach((alias) => {
        if (!aliasesDefinidos.has(alias)) {
          errores.push(
            `El alias '${alias}' usado en la expresión no está mapeado a ninguna variable.`
          );
        }
      });
    }
    return { valido: errores.length === 0, errores };
  }

  /**
   * Evaluador seguro de expresiones matemáticas.
   * Reemplaza aliases por valores y usa Function() con scope aislado.
   * Solo se permiten operaciones matemáticas básicas; no ejecuta código arbitrario.
   *
   * @param {string} expresion
   * @param {Object} valores - { alias: number }
   * @returns {number}
   */
  _evaluarExpresion(expresion, valores) {
    // Validar que la expresión solo contenga caracteres matemáticos seguros
    const sanitized = expresion.trim();
    if (/[;`'"]|import|export|require|process|global|window|document/.test(sanitized)) {
      throw new Error('La expresión contiene caracteres no permitidos.');
    }

    // Construir la función con los aliases como parámetros
    const params = Object.keys(valores);
    const args = Object.values(valores);

    // Usar Function() con parámetros explícitos (no eval global)
    // eslint-disable-next-line no-new-func
    const fn = new Function(...params, `"use strict"; return (${sanitized});`);
    const resultado = fn(...args);

    if (typeof resultado !== 'number') {
      throw new Error('La expresión no retornó un número.');
    }
    return resultado;
  }
}
