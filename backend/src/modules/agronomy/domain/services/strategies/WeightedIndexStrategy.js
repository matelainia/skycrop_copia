import { CalculationStrategy } from './CalculationStrategy.js';

/**
 * WeightedIndexStrategy — Estrategia de Índice Ponderado (Severidad).
 *
 * Calcula un índice de severidad ponderado a partir de conteos por grado
 * en una escala ordinal (ej: escala 0–4 de Horsfall-Barratt).
 *
 * Fórmula general:
 *   Índice = Σ(grado_i × n_i) / (N × grado_max)
 *
 * Aplicaciones agronómicas:
 *   - Índice de severidad foliar (escala 0-4, 0-5, 0-9)
 *   - Índice de defoliación ponderado
 *   - Severidad de síntomas visuales con graduación de daño
 *
 * Configuración:
 *   {
 *     grado_max: 4,          // Grado máximo de la escala utilizada
 *     niveles: [             // Array de grados con su variable de conteo
 *       { grado: 0, variable: 'grado_0' },
 *       { grado: 1, variable: 'grado_1' },
 *       { grado: 2, variable: 'grado_2' },
 *       { grado: 3, variable: 'grado_3' },
 *       { grado: 4, variable: 'grado_4' },
 *     ],
 *     unidad_salida: 'Índice de Severidad'
 *   }
 */
export class WeightedIndexStrategy extends CalculationStrategy {
  static get tipo() {
    return 'indice_ponderado';
  }
  static get label() {
    return 'Índice Ponderado (Severidad)';
  }
  static get descripcion() {
    return (
      'Calcula Σ(Grado × Conteo) ÷ (Total × GradoMáximo). ' +
      'Normaliza conteos por categorías de daño en un índice entre 0 y 1 (o 0 y 100 si se multiplica). ' +
      'Ideal para escalas de Horsfall-Barratt, índices de defoliación y severidad visual graduada.'
    );
  }

  static get esquemaConfiguracion() {
    return [
      {
        campo: 'grado_max',
        label: 'Grado máximo de escala',
        tipo: 'number',
        requerido: true,
        descripcion:
          'El valor máximo de la escala de severidad utilizada (ej: 4 para escala 0-4, 9 para BBCH).'
      },
      {
        campo: 'niveles',
        label: 'Niveles de grado',
        tipo: 'niveles_editor',
        requerido: true,
        descripcion: 'Lista de pares (grado → variable de conteo para ese grado).'
      },
      { campo: 'unidad_salida', label: 'Unidad del indicador', tipo: 'text', requerido: false }
    ];
  }

  calculate(inputData, config, options = {}) {
    const { grado_max, niveles = [], unidad_salida } = config || {};

    if (!grado_max || !Array.isArray(niveles) || niveles.length === 0) {
      return {
        valor: null,
        unidad: unidad_salida || 'Índice',
        valido: false,
        error: 'Configuración de WeightedIndexStrategy incompleta (grado_max o niveles faltantes).'
      };
    }

    let sumaPonderada = 0;
    let totalUnidades = 0;

    for (const nivel of niveles) {
      const conteo = this._extraerNumero(inputData, nivel.variable) ?? 0;
      sumaPonderada += nivel.grado * conteo;
      totalUnidades += conteo;
    }

    if (totalUnidades === 0) {
      return {
        valor: 0,
        unidad: unidad_salida || 'Índice',
        valido: true,
        advertencia: 'Total de unidades igual a cero; índice retornado como 0.'
      };
    }

    const valor = this._round(
      this._dividirSeguro(sumaPonderada, totalUnidades * grado_max),
      options.decimales ?? 4
    );
    return { valor, unidad: unidad_salida || 'Índice', valido: true };
  }

  validateConfig(config) {
    const errores = [];
    if (!config?.grado_max || Number(config.grado_max) <= 0)
      errores.push('Grado máximo debe ser un número positivo.');
    if (!Array.isArray(config?.niveles) || config.niveles.length < 2)
      errores.push('Debe definir al menos 2 niveles de grado.');
    (config?.niveles || []).forEach((n, i) => {
      if (n.grado === undefined || n.grado === null)
        errores.push(`Nivel #${i + 1}: falta el grado.`);
      if (!n.variable) errores.push(`Nivel #${i + 1}: falta la variable de conteo.`);
    });
    return { valido: errores.length === 0, errores };
  }
}
