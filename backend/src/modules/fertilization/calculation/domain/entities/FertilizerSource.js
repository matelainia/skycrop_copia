/**
 * FertilizerSource.js
 * Entidad: fuente fertilizante registrada por el usuario en el Paso 3.
 *
 * REGLAS (§27):
 *  - La composición NUNCA se asume: viene del usuario o de la fuente maestra.
 *  - El precio es OPCIONAL: si no existe, costo = null. No se inventa.
 *  - La composición es DINÁMICA: cualquier código de nutriente registrado
 *    es válido (N, P2O5, K2O, Ca, Mg, S, B, Zn, Fe, ...). No se limita a NPK.
 *  - Se conservan las unidades declaradas (P2O5 sigue siendo P2O5; no se
 *    asume P = P2O5 ni K = K2O).
 */

export const SOURCE_NUTRIENT_CODES = Object.freeze([
  'N',
  'P2O5',
  'K2O',
  'Ca',
  'Mg',
  'S',
  'B',
  'Zn',
  'Fe',
  'Mn',
  'Cu',
  'Mo',
  'Si'
]);

export class InvalidFertilizerSourceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InvalidFertilizerSourceError';
    this.details = details;
  }
}

/**
 * @typedef {Object} FertilizerSourceData
 * @property {string} id - Identificador local de la fuente
 * @property {string} name - Nombre del producto
 * @property {Record<string, number>} composition - Composición garantizada (%) por nutriente
 * @property {number|null} [presentationKg] - Peso de la presentación comercial (kg/bulto)
 * @property {number|null} [pricePerUnit] - Precio por unidad (opcional)
 * @property {boolean} [available] - Disponibilidad (default true)
 * @property {number|null} [minDoseKgHa] - Dosis mínima agronómica kg/ha (opcional)
 * @property {number|null} [maxDoseKgHa] - Dosis máxima agronómica kg/ha (opcional)
 * @property {string|null} [masterFertilizerId] - UUID del catálogo si proviene de la fuente maestra
 */
export class FertilizerSource {
  /**
   * @param {FertilizerSourceData} data
   */
  constructor({
    id,
    name,
    composition,
    presentationKg = null,
    pricePerUnit = null,
    available = true,
    minDoseKgHa = null,
    maxDoseKgHa = null,
    masterFertilizerId = null
  }) {
    if (!id) throw new InvalidFertilizerSourceError('FertilizerSource: id es requerido.');
    if (!name || String(name).trim() === '') {
      throw new InvalidFertilizerSourceError(
        'FertilizerSource: el nombre del producto es requerido.'
      );
    }

    const cleanComposition = FertilizerSource.normalizeComposition(composition);
    if (!cleanComposition) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": la composición garantizada no tiene ningún nutriente con valor > 0.`,
        { composition }
      );
    }

    const totalPct = Object.values(cleanComposition).reduce((s, v) => s + v, 0);
    if (totalPct > 100.01) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": la suma de la composición (${totalPct.toFixed(2)}%) supera 100%.`,
        { totalPct }
      );
    }

    const numOrNull = (v) =>
      v === null || v === undefined || v === ''
        ? null
        : typeof v === 'number' && Number.isFinite(v) && v > 0
          ? v
          : undefined;

    const presentation = numOrNull(presentationKg);
    if (presentation === undefined) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": presentaciónKg debe ser un número > 0.`
      );
    }
    const price = numOrNull(pricePerUnit);
    if (price === undefined) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": pricePerUnit debe ser un número > 0.`
      );
    }
    const minDose = numOrNull(minDoseKgHa);
    if (minDose === undefined) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": minDoseKgHa debe ser un número > 0.`
      );
    }
    const maxDose = numOrNull(maxDoseKgHa);
    if (maxDose === undefined) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": maxDoseKgHa debe ser un número > 0.`
      );
    }
    if (minDose !== null && maxDose !== null && minDose > maxDose) {
      throw new InvalidFertilizerSourceError(
        `Fuente "${name}": minDoseKgHa (${minDose}) no puede superar maxDoseKgHa (${maxDose}).`
      );
    }

    this.id = id;
    this.name = String(name).trim();
    /** Composición normalizada: solo nutrientes con % > 0, redondeados a 4 decimales. */
    this.composition = Object.freeze(cleanComposition);
    this.presentationKg = presentation;
    this.pricePerUnit = price;
    this.available = available !== false;
    this.minDoseKgHa = minDose;
    this.maxDoseKgHa = maxDose;
    this.masterFertilizerId = masterFertilizerId ?? null;
  }

  /** Fracción (0-1) de un nutriente por kg de producto. */
  fractionOf(nutrientCode) {
    return (this.composition[nutrientCode] ?? 0) / 100;
  }

  contains(nutrientCode) {
    return this.fractionOf(nutrientCode) > 0;
  }

  /**
   * Aporte de todos los nutrientes para una dosis dada.
   * @param {number} doseKgHa
   * @returns {Record<string, number>} kg/ha aportados por nutriente
   */
  contributionsFor(doseKgHa) {
    const out = {};
    for (const [code, pct] of Object.entries(this.composition)) {
      out[code] = parseFloat(((doseKgHa * pct) / 100).toFixed(6));
    }
    return out;
  }

  hasPrice() {
    return typeof this.pricePerUnit === 'number' && this.pricePerUnit > 0;
  }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      composition: { ...this.composition },
      presentationKg: this.presentationKg,
      pricePerUnit: this.pricePerUnit,
      available: this.available,
      minDoseKgHa: this.minDoseKgHa,
      maxDoseKgHa: this.maxDoseKgHa,
      masterFertilizerId: this.masterFertilizerId
    };
  }

  toJSON() {
    return this.toObject();
  }

  /**
   * Normaliza una composición cruda: descarta ceros/nulos/no numéricos y
   * valores negativos inválidos. Devuelve null si no queda ningún nutriente.
   * @param {Object} raw
   * @returns {Record<string, number>|null}
   */
  static normalizeComposition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const [code, value] of Object.entries(raw)) {
      if (value === null || value === undefined || value === '') continue;
      const num = Number(value);
      if (!Number.isFinite(num)) continue;
      if (num < 0 || num > 100) continue;
      if (num > 0) out[code] = parseFloat(num.toFixed(4));
    }
    return Object.keys(out).length > 0 ? out : null;
  }
}
