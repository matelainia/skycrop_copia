/**
 * CalculationStrategy — Interface base del Patrón Strategy para indicadores agronómicos.
 *
 * Principio: cualquier nuevo método de cálculo se añade creando una nueva clase que
 * extienda CalculationStrategy. No se modifica ningún código existente (OCP).
 *
 * Ejemplos de estrategias futuras sin cambiar el motor:
 *   - AUDPCStrategy (Área Bajo la Curva de Progreso de Enfermedad)
 *   - ShannonIndexStrategy
 *   - EpidemicProgressRateStrategy
 *   - WeatherDerivedVariableStrategy
 */
export class CalculationStrategy {
  /**
   * Identificador único de la estrategia. Debe coincidir con el valor
   * almacenado en protocolo_indicadores.estrategia_tipo.
   * @returns {string}
   */
  static get tipo() {
    return 'base';
  }

  /**
   * Etiqueta legible para mostrar en la interfaz de usuario.
   * @returns {string}
   */
  static get label() {
    return 'Estrategia Base';
  }

  /**
   * Descripción corta de la metodología para mostrar en el Wizard.
   * @returns {string}
   */
  static get descripcion() {
    return '';
  }

  /**
   * Esquema de la configuración esperada. Se usa para validación y para
   * construir el formulario dinámico del paso "Método de Cálculo" en el Wizard.
   *
   * @returns {Array<{ campo: string, label: string, tipo: string, requerido: boolean, descripcion?: string }>}
   */
  static get esquemaConfiguracion() {
    return [];
  }

  /**
   * Calcula el indicador a partir de los datos capturados en campo.
   *
   * @param {Object} inputData   - Datos capturados: { clave_variable: valor, ... }
   * @param {Object} config      - Configuración almacenada en protocolo_indicadores.configuracion
   * @param {Object} [options]   - Opciones adicionales: { decimales: 2 }
   * @returns {{ valor: number|null, unidad: string, valido: boolean, error?: string }}
   */
  // eslint-disable-next-line no-unused-vars
  calculate(inputData, config, options = {}) {
    throw new Error(
      `[CalculationStrategy] La estrategia "${this.constructor.tipo}" debe implementar calculate().`
    );
  }

  /**
   * Valida la configuración antes de guardar el protocolo.
   * @param {Object} config
   * @returns {{ valido: boolean, errores: string[] }}
   */
  // eslint-disable-next-line no-unused-vars
  validateConfig(config) {
    return { valido: true, errores: [] };
  }

  // ─── Helpers protegidos ───────────────────────────────────────────────────

  /**
   * Redondea un número a las decimales configuradas.
   * @param {number} valor
   * @param {number} decimales
   * @returns {number}
   */
  _round(valor, decimales = 2) {
    if (!isFinite(valor)) return 0;
    const factor = Math.pow(10, decimales);
    return Math.round(valor * factor) / factor;
  }

  /**
   * Divide de forma segura retornando 0 si el divisor es cero o nulo.
   * @param {number} numerador
   * @param {number} denominador
   * @returns {number}
   */
  _dividirSeguro(numerador, denominador) {
    if (!denominador || denominador === 0) return 0;
    return numerador / denominador;
  }

  /**
   * Extrae un valor numérico del objeto de datos de campo.
   * Retorna null si el campo no existe o no es numérico.
   * @param {Object} inputData
   * @param {string} campo
   * @returns {number|null}
   */
  _extraerNumero(inputData, campo) {
    if (
      !campo ||
      inputData[campo] === undefined ||
      inputData[campo] === null ||
      inputData[campo] === ''
    ) {
      return null;
    }
    const val = Number(inputData[campo]);
    return isNaN(val) ? null : val;
  }
}
