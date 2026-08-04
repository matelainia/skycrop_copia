/**
 * fertilization.types.js
 * Tipos, enums y constantes relacionales del módulo Fertilización.
 *
 * Estrategia:
 *   - Los valores de las constantes son los IDs usados en BD / Supabase.
 *   - Las etiquetas de display se resuelven via los mapas de lookup.
 *   - phenologicalStages es relacional por cultivo (apunta a phenological_stages table).
 */

// ─── Estado de Trabajo del Plan ────────────────────────────────────────────────
export const PLAN_STATUS = /** @type {const} */ ({
  DRAFT:     'draft',
  RUNNING:   'running',
  COMPLETED: 'completed',
  ARCHIVED:  'archived',
});

export const PLAN_STATUS_LABELS = {
  [PLAN_STATUS.DRAFT]:     'Borrador',
  [PLAN_STATUS.RUNNING]:   'En ejecución',
  [PLAN_STATUS.COMPLETED]: 'Completado',
  [PLAN_STATUS.ARCHIVED]:  'Archivado',
};

// ─── Estado de Vigencia Agronómica ─────────────────────────────────────────────
export const VALIDITY_STATUS = /** @type {const} */ ({
  ACTIVE:    'active',
  SCHEDULED: 'scheduled',
  EXPIRED:   'expired',
  SUSPENDED: 'suspended',
});

export const VALIDITY_STATUS_LABELS = {
  [VALIDITY_STATUS.ACTIVE]:    'Vigente',
  [VALIDITY_STATUS.SCHEDULED]: 'Programado',
  [VALIDITY_STATUS.EXPIRED]:   'Expirado',
  [VALIDITY_STATUS.SUSPENDED]: 'Suspendido',
};

// ─── Etapas Fenológicas Relacionales por Cultivo ───────────────────────────────
// Cada etapa apunta a phenological_stages.id en Supabase.
// El shape de cada entrada: { id, label, cropId }
export const PHENOLOGICAL_STAGES_BY_CROP = {
  'crop-cacao': [
    { id: 'ps-cacao-floracion',      label: 'Floración',     cropId: 'crop-cacao' },
    { id: 'ps-cacao-cuajado',        label: 'Cuajado',       cropId: 'crop-cacao' },
    { id: 'ps-cacao-cherelle',       label: 'Cherelle',      cropId: 'crop-cacao' },
    { id: 'ps-cacao-llenado',        label: 'Llenado',       cropId: 'crop-cacao' },
    { id: 'ps-cacao-madurez',        label: 'Madurez',       cropId: 'crop-cacao' },
    { id: 'ps-cacao-fructificacion', label: 'Fructificación',cropId: 'crop-cacao' },
  ],
  'crop-banano': [
    { id: 'ps-banano-desv',    label: 'Desarrollo Vegetativo', cropId: 'crop-banano' },
    { id: 'ps-banano-emision', label: 'Emisión',               cropId: 'crop-banano' },
    { id: 'ps-banano-flor',    label: 'Floración',             cropId: 'crop-banano' },
    { id: 'ps-banano-llenado', label: 'Llenado de Fruta',      cropId: 'crop-banano' },
  ],
  'crop-citricos': [
    { id: 'ps-citricos-flor',   label: 'Floración',      cropId: 'crop-citricos' },
    { id: 'ps-citricos-cuaj',   label: 'Cuajado',        cropId: 'crop-citricos' },
    { id: 'ps-citricos-crec',   label: 'Crecimiento',    cropId: 'crop-citricos' },
    { id: 'ps-citricos-madura', label: 'Maduración',     cropId: 'crop-citricos' },
  ],
  'crop-cafe': [
    { id: 'ps-cafe-veg',   label: 'Desarrollo Vegetativo', cropId: 'crop-cafe' },
    { id: 'ps-cafe-flor',  label: 'Floración',             cropId: 'crop-cafe' },
    { id: 'ps-cafe-gran',  label: 'Granado',               cropId: 'crop-cafe' },
    { id: 'ps-cafe-mad',   label: 'Maduración',            cropId: 'crop-cafe' },
    { id: 'ps-cafe-renov', label: 'Renovación',            cropId: 'crop-cafe' },
  ],
  'crop-palma': [
    { id: 'ps-palma-veg',  label: 'Producción',             cropId: 'crop-palma' },
    { id: 'ps-palma-flor', label: 'Floración',              cropId: 'crop-palma' },
    { id: 'ps-palma-inf',  label: 'Inflorescencia',         cropId: 'crop-palma' },
  ],
};

/** Lookup rápido id → label, independiente del cultivo */
export const STAGE_LABEL_BY_ID = Object.values(PHENOLOGICAL_STAGES_BY_CROP)
  .flat()
  .reduce((acc, s) => { acc[s.id] = s.label; return acc; }, {});

// ─── Catálogo de Cultivos ──────────────────────────────────────────────────────
export const CROPS = [
  { id: 'crop-cacao',   name: 'Cacao',       scientificName: 'Theobroma cacao' },
  { id: 'crop-banano',  name: 'Banano',      scientificName: 'Musa spp.' },
  { id: 'crop-citricos',name: 'Cítricos',    scientificName: 'Citrus sinensis' },
  { id: 'crop-cafe',    name: 'Café',        scientificName: 'Coffea arabica' },
  { id: 'crop-palma',   name: 'Palma de Aceite', scientificName: 'Elaeis guineensis' },
];

// ─── Estados Nutricionales (deficiencias) ──────────────────────────────────────
export const NUTRIENT_ELEMENTS = ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Zn', 'B', 'Mn', 'Cu', 'Mo'];

// ─── Tipos del Motor de StatusBadge ───────────────────────────────────────────
// Usado por <StatusBadge type="..." status="..." /> para resolución de variante.
export const STATUS_BADGE_TYPES = /** @type {const} */ ({
  PLAN:      'plan',       // Estados de trabajo: draft, running, completed, archived
  VALIDITY:  'validity',   // Vigencia agronómica: active, scheduled, expired, suspended
  EXECUTION: 'execution',  // Aplicaciones y seguimiento
});

/**
 * @typedef {Object} FertilizationPlan
 * @property {string} id
 * @property {string} code
 * @property {string} version
 * @property {string|null} parentPlanId
 * @property {string} name
 * @property {string} companyId
 * @property {string} farmId
 * @property {string} farmName
 * @property {string} lotId
 * @property {string} lotName
 * @property {string} sectorId
 * @property {string} sectorName
 * @property {string} cropId
 * @property {string} cropName
 * @property {string} scientificName
 * @property {string} phenologicalStageId
 * @property {string} phenologicalStage
 * @property {string} status   — 'draft'|'running'|'completed'|'archived'
 * @property {string} validityStatus — 'active'|'scheduled'|'expired'|'suspended'
 * @property {string} createdAt
 * @property {{ id: string, name: string }} createdBy
 * @property {string} updatedAt
 * @property {{ id: string, name: string }} updatedBy
 * @property {{ id: string, name: string }|null} [approvedBy]
 * @property {string|null} [approvedAt]
 * @property {{ deficiencies: string[], diagnosisDate?: string }|null} [nutritionalStatus]
 * @property {Record<string,any>|null} [metadata]
 */
