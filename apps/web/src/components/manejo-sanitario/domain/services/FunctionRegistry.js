/**
 * FunctionRegistry
 * ================
 * Catálogo extensible de funciones matemáticas y lógicas disponibles en las
 * fórmulas de los indicadores del protocolo.
 *
 * El FormulaEngine NO implementa funciones directamente. Consulta este
 * registro para resolverlas. De esta manera, agregar una función nueva
 * no modifica el parser ni la gramática del motor de fórmulas.
 *
 * Contratos:
 *   - Cada función es pura: misma entrada → misma salida, sin efectos secundarios.
 *   - Toda función recibe un array de argumentos ya evaluados (números o null).
 *   - Toda función retorna un número o null en caso de error controlado.
 *
 * Uso:
 *   const fn = FunctionRegistry.get('ROUND');
 *   const result = fn([15.678, 2]);  // → 15.68
 */

// ─── Helpers internos ─────────────────────────────────────────────────────────

const _toNums = (args) => args.map(a => {
  const n = parseFloat(a);
  return isNaN(n) ? null : n;
});

const _allValid = (nums) => nums.every(n => n !== null);

// ─── Definición del catálogo ──────────────────────────────────────────────────

const _FUNCTIONS = {

  // ── Aritméticas Básicas ─────────────────────────────────────────────────

  /**
   * SUM(a, b, ...) — Suma de todos los argumentos.
   * @example SUM(10, 20, 5) → 35
   */
  SUM: (args) => {
    const nums = _toNums(args);
    const valid = nums.filter(n => n !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
  },

  /**
   * AVG(a, b, ...) — Promedio de todos los argumentos.
   * @example AVG(10, 20, 30) → 20
   */
  AVG: (args) => {
    const nums = _toNums(args);
    const valid = nums.filter(n => n !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  },

  /**
   * MIN(a, b, ...) — Valor mínimo.
   * @example MIN(10, 5, 20) → 5
   */
  MIN: (args) => {
    const nums = _toNums(args).filter(n => n !== null);
    return nums.length > 0 ? Math.min(...nums) : null;
  },

  /**
   * MAX(a, b, ...) — Valor máximo.
   * @example MAX(10, 5, 20) → 20
   */
  MAX: (args) => {
    const nums = _toNums(args).filter(n => n !== null);
    return nums.length > 0 ? Math.max(...nums) : null;
  },

  // ── Redondeo ────────────────────────────────────────────────────────────

  /**
   * ROUND(valor, decimales) — Redondeo a N decimales.
   * @example ROUND(15.678, 2) → 15.68
   */
  ROUND: (args) => {
    if (args.length < 1) return null;
    const nums = _toNums(args);
    if (!_allValid(nums.slice(0, 1))) return null;
    const decimals = nums[1] !== null ? Math.round(nums[1]) : 0;
    const factor = Math.pow(10, decimals);
    return Math.round(nums[0] * factor) / factor;
  },

  /**
   * FLOOR(valor) — Redondeo hacia abajo.
   * @example FLOOR(15.9) → 15
   */
  FLOOR: (args) => {
    const nums = _toNums(args);
    return nums[0] !== null ? Math.floor(nums[0]) : null;
  },

  /**
   * CEIL(valor) — Redondeo hacia arriba.
   * @example CEIL(15.1) → 16
   */
  CEIL: (args) => {
    const nums = _toNums(args);
    return nums[0] !== null ? Math.ceil(nums[0]) : null;
  },

  // ── Matemáticas Avanzadas ───────────────────────────────────────────────

  /**
   * ABS(valor) — Valor absoluto.
   * @example ABS(-10) → 10
   */
  ABS: (args) => {
    const nums = _toNums(args);
    return nums[0] !== null ? Math.abs(nums[0]) : null;
  },

  /**
   * POWER(base, exponente) — Potenciación.
   * @example POWER(2, 10) → 1024
   */
  POWER: (args) => {
    const nums = _toNums(args);
    if (!_allValid(nums.slice(0, 2))) return null;
    return Math.pow(nums[0], nums[1]);
  },

  /**
   * SQRT(valor) — Raíz cuadrada.
   * @example SQRT(16) → 4
   */
  SQRT: (args) => {
    const nums = _toNums(args);
    if (nums[0] === null || nums[0] < 0) return null;
    return Math.sqrt(nums[0]);
  },

  /**
   * LOG(valor, base?) — Logaritmo. Base 10 por defecto, o LN si base === Math.E.
   * @example LOG(100) → 2    LOG(8, 2) → 3
   */
  LOG: (args) => {
    const nums = _toNums(args);
    if (nums[0] === null || nums[0] <= 0) return null;
    const base = nums[1] !== null ? nums[1] : 10;
    return Math.log(nums[0]) / Math.log(base);
  },

  /**
   * LN(valor) — Logaritmo natural.
   * @example LN(Math.E) → 1
   */
  LN: (args) => {
    const nums = _toNums(args);
    if (nums[0] === null || nums[0] <= 0) return null;
    return Math.log(nums[0]);
  },

  // ── Lógicas / Condicionales ──────────────────────────────────────────────

  /**
   * IF(condicion, valor_verdadero, valor_falso) — Condicional ternario.
   * La condición se evalúa como verdadera si es != 0 y != null.
   * @example IF(INCIDENCIA > 10, 1, 0) → 1 si incidencia supera 10
   *
   * Nota: Los argumentos ya llegan pre-evaluados como números.
   *       Un valor de 1 = true, 0 = false.
   */
  IF: (args) => {
    if (args.length < 3) return null;
    const [cond, valTrue, valFalse] = _toNums(args);
    return (cond !== null && cond !== 0) ? (valTrue ?? null) : (valFalse ?? null);
  },

  /**
   * AND(a, b, ...) — Devuelve 1 si todos son != 0, 0 en caso contrario.
   */
  AND: (args) => {
    const nums = _toNums(args);
    return nums.every(n => n !== null && n !== 0) ? 1 : 0;
  },

  /**
   * OR(a, b, ...) — Devuelve 1 si alguno es != 0, 0 en caso contrario.
   */
  OR: (args) => {
    const nums = _toNums(args);
    return nums.some(n => n !== null && n !== 0) ? 1 : 0;
  },

  /**
   * NOT(a) — Negación lógica. Devuelve 1 si a == 0, 0 si a != 0.
   */
  NOT: (args) => {
    const nums = _toNums(args);
    return (nums[0] === null || nums[0] === 0) ? 1 : 0;
  },

  // ── Límites / Normalización ──────────────────────────────────────────────

  /**
   * CLAMP(valor, min, max) — Fuerza el valor dentro del rango [min, max].
   * @example CLAMP(120, 0, 100) → 100
   */
  CLAMP: (args) => {
    const nums = _toNums(args);
    if (!_allValid(nums.slice(0, 3))) return null;
    return Math.min(nums[2], Math.max(nums[1], nums[0]));
  },

  /**
   * PCT(numerador, denominador) — Porcentaje seguro (sin división por cero).
   * @example PCT(15, 100) → 15
   */
  PCT: (args) => {
    const nums = _toNums(args);
    if (!_allValid(nums.slice(0, 2))) return null;
    if (nums[1] === 0) return 0;
    return (nums[0] / nums[1]) * 100;
  },
};

// ─── Interfaz pública ────────────────────────────────────────────────────────

export class FunctionRegistry {

  /**
   * Retorna una función registrada por nombre (insensible a mayúsculas).
   * @param {string} name — Nombre de la función (ej: 'SUM', 'avg', 'IF')
   * @returns {Function} Función pura que acepta un array de argumentos numéricos.
   * @throws {Error} Si la función no está registrada.
   */
  static get(name) {
    const key = String(name).toUpperCase().trim();
    if (!_FUNCTIONS[key]) {
      throw new Error(`[FunctionRegistry] Función no registrada: "${name}". Disponibles: ${FunctionRegistry.list().join(', ')}`);
    }
    return _FUNCTIONS[key];
  }

  /**
   * Verifica si una función está registrada.
   * @param {string} name
   * @returns {boolean}
   */
  static has(name) {
    const key = String(name).toUpperCase().trim();
    return !!_FUNCTIONS[key];
  }

  /**
   * Lista todos los nombres de funciones disponibles.
   * @returns {string[]}
   */
  static list() {
    return Object.keys(_FUNCTIONS);
  }

  /**
   * Registra una nueva función en el catálogo en tiempo de ejecución.
   * Permite extensibilidad sin modificar este archivo.
   *
   * @param {string} name        — Nombre de la función (se almacena en mayúsculas)
   * @param {Function} fn        — Función pura (args: number[]) => number|null
   * @param {boolean} [overwrite=false] — Si true, sobreescribe una función existente
   */
  static register(name, fn, overwrite = false) {
    const key = String(name).toUpperCase().trim();
    if (_FUNCTIONS[key] && !overwrite) {
      throw new Error(`[FunctionRegistry] La función "${key}" ya está registrada. Use overwrite=true para reemplazarla.`);
    }
    _FUNCTIONS[key] = fn;
  }
}
