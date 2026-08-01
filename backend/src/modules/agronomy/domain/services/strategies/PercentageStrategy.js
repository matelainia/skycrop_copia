import { CalculationStrategy } from './CalculationStrategy.js';

/**
 * PercentageStrategy — Estrategia de Porcentaje (Incidencia / Prevalencia).
 *
 * Fórmula: (numerador / denominador) × 100
 *
 * Aplicaciones agronómicas:
 *   - Incidencia de enfermedad: (plantas enfermas / plantas evaluadas) × 100
 *   - Prevalencia: (frutos afectados / frutos evaluados) × 100
 *   - Porcentaje de daño foliar: (hojas dañadas / hojas evaluadas) × 100
 *
 * Configuración:
 *   {
 *     numerador:    'clave_variable_positivos',   // Ej: 'plantas_enfermas'
 *     denominador:  'clave_variable_total',        // Ej: 'plantas_evaluadas'
 *   }
 */
export class PercentageStrategy extends CalculationStrategy {
  static get tipo() {
    return 'porcentaje';
  }
  static get label() {
    return 'Porcentaje (%)';
  }
  static get descripcion() {
    return (
      'Calcula (Casos Positivos ÷ Total Evaluado) × 100. ' +
      'Normaliza el resultado respecto al tamaño de la muestra. ' +
      'Ideal para incidencia, prevalencia y porcentajes de daño.'
    );
  }

  static get esquemaConfiguracion() {
    return [
      {
        campo: 'numerador',
        label: 'Numerador (casos positivos)',
        tipo: 'variable_selector',
        requerido: true,
        descripcion:
          'Variable que representa los casos con la condición de interés (enfermos, afectados, capturados).'
      },
      {
        campo: 'denominador',
        label: 'Denominador (total evaluado)',
        tipo: 'variable_selector',
        requerido: true,
        descripcion: 'Variable que representa el total muestreado (evaluados, inspeccionados).'
      }
    ];
  }

  calculate(inputData, config, options = {}) {
    const { numerador: campoNum, denominador: campoDen } = config || {};

    const num = this._extraerNumero(inputData, campoNum);
    const den = this._extraerNumero(inputData, campoDen);

    if (num === null) {
      return {
        valor: null,
        unidad: '%',
        valido: false,
        error: `Variable numerador '${campoNum}' no encontrada.`
      };
    }
    if (den === null) {
      return {
        valor: null,
        unidad: '%',
        valido: false,
        error: `Variable denominador '${campoDen}' no encontrada.`
      };
    }
    if (den === 0) {
      return {
        valor: 0,
        unidad: '%',
        valido: true,
        advertencia: 'Denominador igual a cero; se retorna 0%.'
      };
    }

    const valor = this._round(this._dividirSeguro(num, den) * 100, options.decimales ?? 2);
    return { valor, unidad: '%', valido: true };
  }

  validateConfig(config) {
    const errores = [];
    if (!config?.numerador)
      errores.push('Debe especificar la variable numerador (casos positivos).');
    if (!config?.denominador)
      errores.push('Debe especificar la variable denominador (total evaluado).');
    if (config?.numerador === config?.denominador)
      errores.push('Numerador y denominador no pueden ser la misma variable.');
    return { valido: errores.length === 0, errores };
  }
}
