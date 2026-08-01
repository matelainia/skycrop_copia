/**
 * FormulaEngine
 * =============
 * Evaluador seguro de expresiones matemáticas para indicadores agronómicos.
 *
 * PRINCIPIOS DE SEGURIDAD:
 *   ❌ NO usa `eval()`, `Function()` ni ningún mecanismo de ejecución dinámica.
 *   ✅ Implementa un parser de expresiones propio mediante:
 *      - Tokenización léxica
 *      - Conversión a Notación Polaca Inversa (Shunting-Yard Algorithm)
 *      - Evaluación mediante pila
 *      - Resolución de funciones a través del FunctionRegistry
 *
 * ENTRADAS:
 *   - Fórmula (string):  "(BARRENADAS / TOTAL) * 100"
 *   - Diccionario:       { BARRENADAS: 15, TOTAL: 100 }
 *
 * SALIDA:
 *   - { valor: 15, valido: true, advertencias: [] }
 *   - { valor: null, valido: false, error: "Variable TOTAL no encontrada" }
 *
 * OPERADORES SOPORTADOS: + - * / ^ % ( )
 * COMPARADORES: > < >= <= == !=
 * FUNCIONES:    Ver FunctionRegistry.list()
 */

import { FunctionRegistry } from './FunctionRegistry.js';

// ─── Tipos de Token ────────────────────────────────────────────────────────────

const TT = {
  NUMBER:   'NUMBER',
  VARIABLE: 'VARIABLE',
  FUNCTION: 'FUNCTION',
  OP:       'OP',
  LPAREN:   'LPAREN',
  RPAREN:   'RPAREN',
  COMMA:    'COMMA',
};

// ─── Precedencia de Operadores ────────────────────────────────────────────────

const PRECEDENCE = {
  '||': 1, '&&': 2,
  '==': 3, '!=': 3,
  '>': 4,  '<': 4,  '>=': 4, '<=': 4,
  '+': 5,  '-': 5,
  '*': 6,  '/': 6,  '%': 6,
  '^': 7,  // Potencia: asociatividad derecha
  'u-': 8, // Negación unaria
};

const RIGHT_ASSOC = new Set(['^', 'u-']);

// ─── Clase Principal ──────────────────────────────────────────────────────────

export class FormulaEngine {

  /**
   * Evalúa una fórmula con el diccionario de variables dado.
   *
   * @param {string} formula      — Expresión matemática (ej: "(SANAS / TOTAL) * 100")
   * @param {Object} variables    — Mapa { CLAVE: valor } (todos los valores deben ser números o null)
   * @param {Object} [options]
   * @param {number} [options.decimales=6]   — Precisión del resultado
   * @param {boolean} [options.strict=false] — Si true, lanza error en var. faltantes; si false, usa 0
   * @returns {{ valor: number|null, valido: boolean, error: string|null, advertencias: string[] }}
   */
  static evaluate(formula, variables = {}, options = {}) {
    const { decimales = 6, strict = false } = options;
    const advertencias = [];

    if (!formula || !formula.trim()) {
      return { valor: null, valido: false, error: 'Fórmula vacía', advertencias };
    }

    try {
      const tokens = FormulaEngine._tokenize(formula);
      const rpn    = FormulaEngine._toRPN(tokens);
      const valor  = FormulaEngine._evalRPN(rpn, variables, strict, advertencias);

      if (valor === null) {
        return { valor: null, valido: false, error: 'Resultado indefinido (posible división por cero o variable nula)', advertencias };
      }

      const rounded = parseFloat(valor.toFixed(decimales));
      return { valor: rounded, valido: true, error: null, advertencias };

    } catch (err) {
      return { valor: null, valido: false, error: err.message, advertencias };
    }
  }

  /**
   * Valida que una fórmula sea sintácticamente correcta y que todas las funciones
   * referenciadas existan en el FunctionRegistry.
   *
   * @param {string} formula
   * @param {string[]} [knownVariables] — Lista de claves de variables conocidas
   * @returns {{ valido: boolean, errores: string[] }}
   */
  static validate(formula, knownVariables = []) {
    const errores = [];

    if (!formula || !formula.trim()) {
      return { valido: false, errores: ['La fórmula está vacía'] };
    }

    try {
      const tokens = FormulaEngine._tokenize(formula);

      // Verificar funciones registradas
      for (const token of tokens) {
        if (token.type === TT.FUNCTION) {
          if (!FunctionRegistry.has(token.value)) {
            errores.push(`Función desconocida: "${token.value}". Funciones disponibles: ${FunctionRegistry.list().join(', ')}`);
          }
        }
      }

      // Verificar variables referenciadas (sólo como advertencia si no se pasan knownVariables)
      if (knownVariables.length > 0) {
        for (const token of tokens) {
          if (token.type === TT.VARIABLE && !knownVariables.includes(token.value)) {
            errores.push(`Variable no declarada en el protocolo: "${token.value}"`);
          }
        }
      }

      // Intento de conversión a RPN para detectar errores de paréntesis/sintaxis
      if (errores.length === 0) {
        FormulaEngine._toRPN(tokens);
      }

    } catch (err) {
      errores.push(`Error de sintaxis: ${err.message}`);
    }

    return { valido: errores.length === 0, errores };
  }

  // ─── TOKENIZADOR ────────────────────────────────────────────────────────────

  /**
   * Convierte la fórmula string en una lista de tokens.
   * @param {string} formula
   * @returns {Token[]}
   */
  static _tokenize(formula) {
    const tokens = [];
    let i = 0;
    const src = formula.trim();

    while (i < src.length) {
      const ch = src[i];

      // Espacios
      if (/\s/.test(ch)) { i++; continue; }

      // Número (incluye decimales y notación científica básica)
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1]))) {
        let num = '';
        while (i < src.length && /[0-9.eE+\-]/.test(src[i])) {
          // Detener en +/- si no es parte de exponente
          if ((src[i] === '+' || src[i] === '-') && !/[eE]/.test(num[num.length - 1])) break;
          num += src[i++];
        }
        const parsed = parseFloat(num);
        if (isNaN(parsed)) throw new Error(`Número inválido: "${num}"`);
        tokens.push({ type: TT.NUMBER, value: parsed });
        continue;
      }

      // Identificadores: Variables o Funciones
      if (/[A-Za-z_]/.test(ch)) {
        let id = '';
        while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) id += src[i++];
        // Look-ahead: si sigue un '(' es función, si no es variable
        const isFunction = (i < src.length && src[i] === '(');
        tokens.push({ type: isFunction ? TT.FUNCTION : TT.VARIABLE, value: id.toUpperCase() });
        continue;
      }

      // Operadores multi-caracter
      if (['>', '<', '=', '!', '&', '|'].includes(ch)) {
        const two = src.slice(i, i + 2);
        if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) {
          tokens.push({ type: TT.OP, value: two }); i += 2; continue;
        }
        if (['>', '<'].includes(ch)) {
          tokens.push({ type: TT.OP, value: ch }); i++; continue;
        }
      }

      // Operadores simples
      if (['+', '-', '*', '/', '^', '%'].includes(ch)) {
        // Detectar negación unaria: '-' al inicio o después de '(' o después de otro operador
        if (ch === '-') {
          const prev = tokens[tokens.length - 1];
          const isUnary = !prev || prev.type === TT.LPAREN || prev.type === TT.OP || prev.type === TT.COMMA;
          if (isUnary) {
            tokens.push({ type: TT.OP, value: 'u-' }); i++; continue;
          }
        }
        tokens.push({ type: TT.OP, value: ch }); i++; continue;
      }

      if (ch === '(') { tokens.push({ type: TT.LPAREN, value: '(' }); i++; continue; }
      if (ch === ')') { tokens.push({ type: TT.RPAREN, value: ')' }); i++; continue; }
      if (ch === ',') { tokens.push({ type: TT.COMMA,  value: ',' }); i++; continue; }

      throw new Error(`Carácter inesperado en fórmula: "${ch}" en posición ${i}`);
    }

    return tokens;
  }

  // ─── SHUNTING-YARD (Infix → RPN) ────────────────────────────────────────────

  /**
   * Convierte lista de tokens en Notación Polaca Inversa (RPN).
   * @param {Token[]} tokens
   * @returns {Token[]}
   */
  static _toRPN(tokens) {
    const output = [];
    const opStack = [];
    const arityStack = []; // seguimiento de aridades de funciones

    for (const token of tokens) {
      if (token.type === TT.NUMBER || token.type === TT.VARIABLE) {
        output.push(token);
      } else if (token.type === TT.FUNCTION) {
        opStack.push(token);
        arityStack.push(1); // al menos 1 argumento
      } else if (token.type === TT.COMMA) {
        // Vaciar hasta el paréntesis izquierdo
        while (opStack.length && opStack[opStack.length - 1].type !== TT.LPAREN) {
          output.push(opStack.pop());
        }
        if (!opStack.length) throw new Error('Paréntesis desbalanceados (coma fuera de función)');
        // Incrementar aridad
        if (arityStack.length > 0) arityStack[arityStack.length - 1]++;
      } else if (token.type === TT.OP) {
        const prec = PRECEDENCE[token.value] ?? 0;
        while (
          opStack.length &&
          opStack[opStack.length - 1].type === TT.OP &&
          ((PRECEDENCE[opStack[opStack.length - 1].value] ?? 0) > prec ||
           ((PRECEDENCE[opStack[opStack.length - 1].value] ?? 0) === prec && !RIGHT_ASSOC.has(token.value)))
        ) {
          output.push(opStack.pop());
        }
        opStack.push(token);
      } else if (token.type === TT.LPAREN) {
        opStack.push(token);
      } else if (token.type === TT.RPAREN) {
        while (opStack.length && opStack[opStack.length - 1].type !== TT.LPAREN) {
          output.push(opStack.pop());
        }
        if (!opStack.length) throw new Error('Paréntesis desbalanceados: ")" sin "(" correspondiente');
        opStack.pop(); // eliminar '('
        if (opStack.length && opStack[opStack.length - 1].type === TT.FUNCTION) {
          const fn = opStack.pop();
          fn.arity = arityStack.pop();
          output.push(fn);
        }
      }
    }

    while (opStack.length) {
      const top = opStack.pop();
      if (top.type === TT.LPAREN) throw new Error('Paréntesis desbalanceados: "(" sin ")" correspondiente');
      output.push(top);
    }

    return output;
  }

  // ─── EVALUACIÓN RPN ──────────────────────────────────────────────────────────

  /**
   * Evalúa la expresión en RPN usando el diccionario de variables.
   * @param {Token[]} rpn
   * @param {Object} variables
   * @param {boolean} strict
   * @param {string[]} advertencias
   * @returns {number|null}
   */
  static _evalRPN(rpn, variables, strict, advertencias) {
    const stack = [];

    for (const token of rpn) {

      if (token.type === TT.NUMBER) {
        stack.push(token.value);

      } else if (token.type === TT.VARIABLE) {
        const clave = token.value;
        const rawVal = variables[clave] ?? variables[clave.toLowerCase()] ?? variables[clave.toUpperCase()];

        if (rawVal === undefined || rawVal === null || rawVal === '') {
          if (strict) {
            throw new Error(`Variable "${clave}" no encontrada en el diccionario de variables`);
          } else {
            advertencias.push(`Variable "${clave}" no encontrada. Se usará 0 como valor.`);
            stack.push(0);
          }
        } else {
          const num = parseFloat(rawVal);
          if (isNaN(num)) {
            advertencias.push(`Variable "${clave}" no es numérica (valor: "${rawVal}"). Se usará 0.`);
            stack.push(0);
          } else {
            stack.push(num);
          }
        }

      } else if (token.type === TT.FUNCTION) {
        const arity = token.arity ?? 1;
        if (stack.length < arity) {
          throw new Error(`Función "${token.value}" requiere ${arity} argumento(s) pero se encontraron ${stack.length}`);
        }
        const args = stack.splice(stack.length - arity, arity);
        const fn = FunctionRegistry.get(token.value);
        const result = fn(args);
        stack.push(result);

      } else if (token.type === TT.OP) {
        const op = token.value;

        // Negación unaria
        if (op === 'u-') {
          if (stack.length < 1) throw new Error('Operador unario "-" sin operando');
          stack.push(-stack.pop());
          continue;
        }

        if (stack.length < 2) throw new Error(`Operador "${op}" requiere 2 operandos`);
        const b = stack.pop();
        const a = stack.pop();

        let result;
        switch (op) {
          case '+':  result = (a ?? 0) + (b ?? 0); break;
          case '-':  result = (a ?? 0) - (b ?? 0); break;
          case '*':  result = (a ?? 0) * (b ?? 0); break;
          case '/':
            if (b === 0 || b === null) {
              advertencias.push('División por cero detectada. Resultado: 0.');
              result = 0;
            } else {
              result = a / b;
            }
            break;
          case '%':  result = b === 0 ? 0 : a % b; break;
          case '^':  result = Math.pow(a ?? 0, b ?? 0); break;
          case '>':  result = (a > b)  ? 1 : 0; break;
          case '<':  result = (a < b)  ? 1 : 0; break;
          case '>=': result = (a >= b) ? 1 : 0; break;
          case '<=': result = (a <= b) ? 1 : 0; break;
          case '==': result = (a === b) ? 1 : 0; break;
          case '!=': result = (a !== b) ? 1 : 0; break;
          case '&&': result = (a && b)  ? 1 : 0; break;
          case '||': result = (a || b)  ? 1 : 0; break;
          default:   throw new Error(`Operador desconocido: "${op}"`);
        }

        stack.push(result);
      }
    }

    if (stack.length !== 1) {
      throw new Error(`Error en la evaluación: la pila final tiene ${stack.length} elemento(s) en lugar de 1`);
    }

    const finalValue = stack[0];
    return (finalValue === null || isNaN(finalValue)) ? null : finalValue;
  }
}
