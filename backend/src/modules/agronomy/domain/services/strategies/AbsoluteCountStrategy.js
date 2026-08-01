import { CalculationStrategy } from './CalculationStrategy.js';

/**
 * AbsoluteCountStrategy — Estrategia de Conteo Absoluto.
 *
 * Retorna directamente el valor capturado en la variable fuente, sin
 * ninguna transformación. Es la estrategia predeterminada para protocolos
 * legados y para casos donde el valor absoluto ya es el indicador.
 *
 * Ejemplo de uso:
 *   Número de trampas con capturas, Individuos contados, Número de focos.
 *
 * Configuración:
 *   { variable_fuente: 'nombre_clave_variable' }
 */
export class AbsoluteCountStrategy extends CalculationStrategy {
  static get tipo() {
    return 'absoluto';
  }
  static get label() {
    return 'Conteo Absoluto';
  }
  static get descripcion() {
    return (
      'Usa el valor capturado directamente como indicador. ' +
      'Ideal para conteos donde el número absoluto ya tiene significado por sí solo ' +
      '(ej: número de trampas con capturas, focos detectados).'
    );
  }

  static get esquemaConfiguracion() {
    return [
      {
        campo: 'variable_fuente',
        label: 'Variable fuente',
        tipo: 'variable_selector',
        requerido: true,
        descripcion: 'La variable cuyo valor se usará directamente como indicador.'
      }
    ];
  }

  calculate(inputData, config, options = {}) {
    const { variable_fuente } = config || {};
    const valor = this._extraerNumero(inputData, variable_fuente);

    if (valor === null) {
      return {
        valor: null,
        unidad: config?.unidad || '',
        valido: false,
        error: `Variable '${variable_fuente}' no encontrada o vacía.`
      };
    }

    return {
      valor: this._round(valor, options.decimales ?? 0),
      unidad: config?.unidad || '',
      valido: true
    };
  }

  validateConfig(config) {
    const errores = [];
    if (!config?.variable_fuente) errores.push('Debe especificar la variable fuente.');
    return { valido: errores.length === 0, errores };
  }
}
