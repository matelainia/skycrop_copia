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
      const palabrasReservadas = [
        'Math',
        'PI',
        'E',
        'abs',
        'sqrt',
        'min',
        'max',
        'pow',
        'log',
        'exp',
        'round',
        'floor',
        'ceil',
        'sin',
        'cos',
        'tan'
      ];
      const aliasesEnExpresion = (config.expresion.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []).filter(
        (t) => !palabrasReservadas.includes(t)
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
   *
   * Implementación con parser recursivo descendente propio: NO usa eval(),
   * Function() ni acceso a propiedades. Solo acepta números, los aliases
   * provistos, paréntesis, operadores (+, -, *, /, %, ^) y un conjunto
   * cerrado de funciones matemáticas de Math.
   *
   * Compatibilidad hacia atrás: se acepta la sintaxis "Math.fn(x)" además de "fn(x)".
   *
   * @param {string} expresion
   * @param {Object} valores - { alias: number }
   * @returns {number}
   */
  _evaluarExpresion(expresion, valores) {
    // Validación explícita de caracteres prohibidos (mensaje histórico preservado)
    const sanitized = expresion.trim();
    if (/[;`'"=]|import|export|require|process|global|window|document/.test(sanitized)) {
      throw new Error('La expresión contiene caracteres no permitidos.');
    }

    const FUNCIONES_SEGURAS = {
      abs: Math.abs,
      sqrt: Math.sqrt,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      log: Math.log,
      exp: Math.exp,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan
    };
    const CONSTANTES = { PI: Math.PI, E: Math.E };

    // ── Tokenizador ────────────────────────────────────────────────────────
    const tokens = [];
    let i = 0;
    while (i < sanitized.length) {
      const ch = sanitized[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        let num = '';
        while (i < sanitized.length && /[0-9.]/.test(sanitized[i])) num += sanitized[i++];
        const value = Number(num);
        if (Number.isNaN(value)) throw new Error(`Número inválido: ${num}`);
        tokens.push({ tipo: 'numero', valor: value });
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        let nombre = '';
        while (i < sanitized.length && /[a-zA-Z0-9_]/.test(sanitized[i])) nombre += sanitized[i++];
        // Compatibilidad: prefijo "Math." para las funciones permitidas
        if (nombre === 'Math' && sanitized[i] === '.' && /[a-zA-Z_]/.test(sanitized[i + 1] || '')) {
          i++; // consumir '.'
          let fn = '';
          while (i < sanitized.length && /[a-zA-Z0-9_]/.test(sanitized[i])) fn += sanitized[i++];
          tokens.push({ tipo: 'funcion', nombre: fn });
          continue;
        }
        tokens.push({ tipo: 'identificador', nombre });
        continue;
      }
      if ('+-*/%^(),'.includes(ch)) {
        tokens.push({ tipo: ch === ',' ? ',' : ch });
        i++;
        continue;
      }
      throw new Error(`Carácter no permitido en la fórmula: '${ch}'`);
    }

    // ── Parser (recursivo descendente) ─────────────────────────────────────
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function parseExpression() {
      let izq = parseTerm();
      while (peek() && (peek().tipo === '+' || peek().tipo === '-')) {
        const op = next().tipo;
        const der = parseTerm();
        izq = op === '+' ? izq + der : izq - der;
      }
      return izq;
    }

    function parseTerm() {
      let izq = parseUnary();
      while (peek() && (peek().tipo === '*' || peek().tipo === '/' || peek().tipo === '%')) {
        const op = next().tipo;
        const der = parseUnary();
        izq = op === '*' ? izq * der : op === '/' ? izq / der : izq % der;
      }
      return izq;
    }

    function parseUnary() {
      if (peek() && (peek().tipo === '-' || peek().tipo === '+')) {
        const op = next().tipo;
        const val = parseUnary();
        return op === '-' ? -val : val;
      }
      return parsePower();
    }

    function parsePower() {
      const base = parseAtom();
      if (peek() && peek().tipo === '^') {
        next();
        const exponente = parseUnary();
        return Math.pow(base, exponente);
      }
      return base;
    }

    function parseArgs() {
      const args = [];
      if (peek() && peek().tipo !== ')') {
        args.push(parseExpression());
        while (peek() && peek().tipo === ',') {
          next();
          args.push(parseExpression());
        }
      }
      return args;
    }

    function parseAtom() {
      const tok = next();
      if (!tok) throw new Error('Expresión incompleta.');

      if (tok.tipo === 'numero') return tok.valor;

      if (tok.tipo === '(') {
        const val = parseExpression();
        const cierre = next();
        if (!cierre || cierre.tipo !== ')') throw new Error('Paréntesis desbalanceados.');
        return val;
      }

      if (tok.tipo === 'funcion') {
        const fn = FUNCIONES_SEGURAS[tok.nombre];
        if (!fn) throw new Error(`Función no permitida: ${tok.nombre}`);
        const abre = next();
        if (!abre || abre.tipo !== '(') throw new Error(`Se esperaba '(' tras ${tok.nombre}.`);
        const args = parseArgs();
        const cierra = next();
        if (!cierra || cierra.tipo !== ')') throw new Error('Paréntesis desbalanceados.');
        return fn(...args);
      }

      if (tok.tipo === 'identificador') {
        if (tok.nombre in CONSTANTES) return CONSTANTES[tok.nombre];
        if (tok.nombre in valores) return valores[tok.nombre];
        if (tok.nombre in FUNCIONES_SEGURAS) {
          const abre = next();
          if (!abre || abre.tipo !== '(') {
            throw new Error(`Se esperaba '(' tras ${tok.nombre}.`);
          }
          const args = parseArgs();
          const cierra = next();
          if (!cierra || cierra.tipo !== ')') throw new Error('Paréntesis desbalanceados.');
          return FUNCIONES_SEGURAS[tok.nombre](...args);
        }
        throw new Error(`Variable o función desconocida: ${tok.nombre}`);
      }

      throw new Error(`Token inesperado: ${JSON.stringify(tok)}`);
    }

    const resultado = parseExpression();

    if (pos < tokens.length) {
      throw new Error('Tokens sobrantes al final de la expresión.');
    }
    if (typeof resultado !== 'number' || Number.isNaN(resultado)) {
      throw new Error('La expresión no retornó un número.');
    }
    return resultado;
  }
}
