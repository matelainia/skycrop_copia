import { AbsoluteCountStrategy } from './AbsoluteCountStrategy.js';
import { PercentageStrategy } from './PercentageStrategy.js';
import { AverageStrategy } from './AverageStrategy.js';
import { WeightedIndexStrategy } from './WeightedIndexStrategy.js';
import { FormulaStrategy } from './FormulaStrategy.js';

/**
 * StrategyRegistry — Registro central de estrategias de cálculo (Patrón Registry + Strategy).
 *
 * Principio de extensibilidad (OCP):
 *   Para agregar una nueva estrategia de cálculo (ej: AUDPCStrategy, ShannonIndexStrategy),
 *   solo se necesita:
 *     1. Crear la clase extendiendo CalculationStrategy.
 *     2. Importarla y llamar a StrategyRegistry.register(NuevaStrategy).
 *   No se modifica ningún otro código del sistema.
 *
 * Uso:
 *   const strategy = StrategyRegistry.get('porcentaje');
 *   const resultado = strategy.calculate(inputData, config, { decimales: 2 });
 *
 *   const estrategias = StrategyRegistry.all();
 *   // → [{ tipo, label, descripcion, esquemaConfiguracion }, ...]
 */
class StrategyRegistryClass {
  constructor() {
    /** @type {Map<string, CalculationStrategy>} */
    this._registry = new Map();
    this._instances = new Map();
  }

  /**
   * Registra una clase de estrategia.
   * @param {typeof import('./CalculationStrategy.js').CalculationStrategy} StrategyClass
   */
  register(StrategyClass) {
    if (!StrategyClass.tipo) {
      throw new Error(
        `[StrategyRegistry] La estrategia ${StrategyClass.name} no define un 'tipo' estático.`
      );
    }
    this._registry.set(StrategyClass.tipo, StrategyClass);
    this._instances.set(StrategyClass.tipo, new StrategyClass());
  }

  /**
   * Obtiene una instancia de la estrategia por tipo.
   * @param {string} tipo
   * @returns {import('./CalculationStrategy.js').CalculationStrategy}
   */
  get(tipo) {
    const instance = this._instances.get(tipo);
    if (!instance) {
      // Fallback: si el tipo no existe, usar AbsoluteCountStrategy para no romper datos legados
      console.warn(
        `[StrategyRegistry] Estrategia '${tipo}' no encontrada. Usando 'absoluto' como fallback.`
      );
      return this._instances.get('absoluto');
    }
    return instance;
  }

  /**
   * Retorna todas las estrategias registradas en formato de catálogo
   * para poblar el selector de estrategia en el Wizard del protocolo.
   * @returns {Array<{ tipo, label, descripcion, esquemaConfiguracion }>}
   */
  all() {
    return Array.from(this._registry.values()).map((Cls) => ({
      tipo: Cls.tipo,
      label: Cls.label,
      descripcion: Cls.descripcion,
      esquemaConfiguracion: Cls.esquemaConfiguracion
    }));
  }

  /**
   * Verifica si un tipo de estrategia está registrado.
   * @param {string} tipo
   * @returns {boolean}
   */
  has(tipo) {
    return this._registry.has(tipo);
  }
}

// Singleton del registry
export const StrategyRegistry = new StrategyRegistryClass();

// ── Registro de estrategias incluidas en el core ──────────────────────────────
// Para añadir nuevas estrategias: importar la clase y llamar a register() aquí.
StrategyRegistry.register(AbsoluteCountStrategy);
StrategyRegistry.register(PercentageStrategy);
StrategyRegistry.register(AverageStrategy);
StrategyRegistry.register(WeightedIndexStrategy);
StrategyRegistry.register(FormulaStrategy);

// Ejemplo de cómo añadir una estrategia futura sin tocar el código anterior:
// import { AUDPCStrategy } from './AUDPCStrategy.js';
// StrategyRegistry.register(AUDPCStrategy);
