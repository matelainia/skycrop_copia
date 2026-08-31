/**
 * recommendation.types.js
 * Modelo conceptual de recomendación (§22) — data-driven, extensible.
 *
 * Estructura alineada con el contrato del motor fert_calc_* y con
 * la captura de la calculadora (Paso 3: Recomendación).
 */

// ─── Nutrientes canónicos + extensibles (§6) ──────────────────────────────

/**
 * Cada nutriente es data-driven; no columnas rígidas en React.
 * @typedef {{ code:string, name:string, symbol:string, unit:string, defaultPct:number|null, enabled:boolean }} NutrientDef
 */
export const NUTRIENT_CATALOG = [
  { code: 'N',    name: 'Nitrógeno',  symbol: 'N',    unit: '%', enabled: true },
  { code: 'P2O5', name: 'Fósforo',    symbol: 'P₂O₅', unit: '%', enabled: true },
  { code: 'K2O',  name: 'Potasio',    symbol: 'K₂O',  unit: '%', enabled: true },
  { code: 'Ca',   name: 'Calcio',     symbol: 'Ca',   unit: '%', enabled: true },
  { code: 'Mg',   name: 'Magnesio',   symbol: 'Mg',   unit: '%', enabled: true },
  { code: 'S',    name: 'Azufre',     symbol: 'S',    unit: '%', enabled: true },
  { code: 'B',    name: 'Boro',       symbol: 'B',    unit: '%', enabled: false },
  { code: 'Zn',   name: 'Zinc',       symbol: 'Zn',   unit: '%', enabled: false },
  { code: 'Fe',   name: 'Hierro',     symbol: 'Fe',   unit: '%', enabled: false },
  { code: 'Mn',   name: 'Manganeso',  symbol: 'Mn',   unit: '%', enabled: false },
  { code: 'Cu',   name: 'Cobre',      symbol: 'Cu',   unit: '%', enabled: false },
  { code: 'Mo',   name: 'Molibdeno',  symbol: 'Mo',   unit: '%', enabled: false },
];

export const PRIMARY_NUTRIENTS = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S'];
export const ALL_KNOWN_NUTRIENTS = NUTRIENT_CATALOG.map((n) => n.code);

// ─── Presentaciones comerciales (§7) ───────────────────────────────────────

export const PRESENTATION_OPTIONS = [
  { value: 1,    label: '1 kg' },
  { value: 5,    label: '5 kg' },
  { value: 10,   label: '10 kg' },
  { value: 25,   label: '25 kg' },
  { value: 40,   label: '40 kg' },
  { value: 50,   label: '50 kg' },
  { value: 1000, label: '1 000 kg' },
  { value: 'custom', label: 'Personalizada…' },
];

// ─── Modos de dosificación (§8) ────────────────────────────────────────────

export const DOSE_MODES = [
  { id: 'kg_ha',       label: 'kg/ha',       hint: 'kilogramos por hectárea' },
  { id: 'kg_planta',   label: 'kg/planta',   hint: 'kilogramos por planta' },
  { id: 'g_planta',    label: 'g/planta',    hint: 'gramos por planta' },
  { id: 'bultos_ha',   label: 'bultos/ha',   hint: 'bultos por hectárea' },
  { id: 'bultos_lote', label: 'bultos/lote', hint: 'bultos totales para el lote' },
  { id: 'kg_lote',     label: 'kg/lote',     hint: 'kilogramos totales para el lote' },
];

// ─── Fábricas ───────────────────────────────────────────────────────────────

/**
 * Crea una fila vacía de aplicación de fertilizante (§22).
 */
export function createEmptyFertilizerRow() {
  return {
    id: crypto.randomUUID(),
    productId: null,            // BIGINT productos.id si viene de catálogo
    fertilizerId: null,         // UUID fert_calc_fertilizers.id si aplica
    productName: '',
    presentationKg: 50,
    presentationCustom: '',
    nutrients: Object.fromEntries(ALL_KNOWN_NUTRIENTS.map((c) => [c, ''])),
    enabledNutrients: [...PRIMARY_NUTRIENTS], // columnas visibles
    customNutrients: [],        // [{code,name,value}]
    doseMode: 'kg_ha',
    doseValue: '',
    plantsPerHa: '',
    // calculated — nunca editable directamente
    _derived: null,
  };
}

/**
 * Totales vacíos para el resumen.
 */
export function emptyRecommendationTotals() {
  return {
    doseTotalKgHa: 0,
    doseTotalKgPlant: null,
    doseTotalGPlant: null,
    totalKg: null,
    totalBags: null,
    totalContribution: {},
    coverage: {},
  };
}

// ─── Helpers de nutrientes ─────────────────────────────────────────────────

export function nutrientLabel(code) {
  const found = NUTRIENT_CATALOG.find((n) => n.code === code);
  return found ? found.symbol : code;
}

export function isValidPct(v) {
  if (v === '' || v === null || v === undefined) return true; // vacío permitido
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}
