import { CalculationStrategy } from './CalculationStrategy.js';

/**
 * AverageStrategy — Estrategia de Promedio.
 *
 * Fórmula: total_acumulado / unidades_evaluadas
 *
 * Aplicaciones agronómicas:
 *   - Densidad de insectos: (total capturas) / (plantas evaluadas) → Insectos/planta
 *   - Carga media de frutos: (frutos contados) / (ramas evaluadas) → Frutos/rama
 *   - Lesiones promedio por hoja: (lesiones) / (hojas evaluadas)
 *
 * Configuración:
 *   {
 *     total:       'clave_variable_acumulado',   // Ej: 'total_insectos'
 *     unidades:    'clave_variable_evaluados',    // Ej: 'plantas_evaluadas'
 *     unidad_salida: 'Insectos/planta'            // Texto libre para la unidad del indicador
 *   }
 */
export class AverageStrategy extends CalculationStrategy {
  static get tipo() {
    return 'promedio';
  }
  static get label() {
    return 'Promedio (Densidad)';
  }
  static get descripcion() {
    return (
      'Calcula Total Acumulado ÷ Unidades Evaluadas. ' +
      'Retorna una densidad o valor por unidad de muestreo. ' +
      'Ideal para infestación por planta, lesiones por hoja, capturas por trampa.'
    );
  }

  static get esquemaConfiguracion() {
    return [
      {
        campo: 'total',
        label: 'Total acumulado',
        tipo: 'variable_selector',
        requerido: true,
        descripcion:
          'Variable que representa la suma total registrada (insectos contados, lesiones, etc.).'
      },
      {
        campo: 'unidades',
        label: 'Unidades evaluadas',
        tipo: 'variable_selector',
        requerido: true,
        descripcion:
          'Variable que representa el número de unidades inspeccionadas (plantas, hojas, trampas).'
      },
      {
        campo: 'unidad_salida',
        label: 'Unidad del indicador',
        tipo: 'text',
        requerido: false,
        descripcion:
          'Texto que describe la unidad resultante, ej: "Insectos/planta", "Lesiones/hoja".'
      }
    ];
  }

  calculate(inputData, config, options = {}) {
    const { total: campoTotal, unidades: campoUnidades, unidad_salida } = config || {};

    const total = this._extraerNumero(inputData, campoTotal);
    const unidades = this._extraerNumero(inputData, campoUnidades);

    if (total === null) {
      return {
        valor: null,
        unidad: unidad_salida || '',
        valido: false,
        error: `Variable total '${campoTotal}' no encontrada.`
      };
    }
    if (unidades === null) {
      return {
        valor: null,
        unidad: unidad_salida || '',
        valido: false,
        error: `Variable unidades '${campoUnidades}' no encontrada.`
      };
    }
    if (unidades === 0) {
      return {
        valor: 0,
        unidad: unidad_salida || '',
        valido: true,
        advertencia: 'Denominador (unidades) igual a cero; se retorna 0.'
      };
    }

    const valor = this._round(this._dividirSeguro(total, unidades), options.decimales ?? 2);
    return { valor, unidad: unidad_salida || '', valido: true };
  }

  validateConfig(config) {
    const errores = [];
    if (!config?.total) errores.push('Debe especificar la variable de total acumulado.');
    if (!config?.unidades) errores.push('Debe especificar la variable de unidades evaluadas.');
    if (config?.total === config?.unidades)
      errores.push('Total y unidades no pueden ser la misma variable.');
    return { valido: errores.length === 0, errores };
  }
}
