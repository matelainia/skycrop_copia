// Catalog of fertilizer products with formulas, nutritional types, and badge styling
export const PRODUCTS_CATALOG = [
  {
    id: 'kcl',
    name: 'KCl (0-0-60)',
    formula: '0-0-60',
    typeNut: 'K',
    badgeColor: 'amber',
    defaultCostUnit: 9000, // COP/kg
  },
  {
    id: 'urea',
    name: 'Urea (46-0-0)',
    formula: '46-0-0',
    typeNut: 'N',
    badgeColor: 'blue',
    defaultCostUnit: 9800, // COP/kg
  },
  {
    id: 'dap',
    name: 'DAP (18-46-0)',
    formula: '18-46-0',
    typeNut: 'N-P',
    badgeColor: 'purple',
    defaultCostUnit: 14375, // COP/kg
  },
  {
    id: 'foliar-20-20-20',
    name: 'Foliar Nutrimix 20-20-20',
    formula: '20-20-20',
    typeNut: 'Fol',
    badgeColor: 'teal',
    defaultCostUnit: 140000, // COP/L
  },
  {
    id: 'foliar-boro',
    name: 'Foliar Boro & Zinc',
    formula: '0-0-0 + B + Zn',
    typeNut: 'Fol',
    badgeColor: 'teal',
    defaultCostUnit: 190000, // COP/L
  },
  {
    id: 'cal-dolomita',
    name: 'Cal Agrícola Dolomita',
    formula: 'CaCO3 + MgCO3',
    typeNut: 'Corr',
    badgeColor: 'gray',
    defaultCostUnit: 2500, // COP/kg
  },
  {
    id: 'compost-organico',
    name: 'Compost Orgánico Enriquecido',
    formula: 'Materia Orgánica 45%',
    typeNut: 'Org',
    badgeColor: 'green',
    defaultCostUnit: 3500, // COP/kg
  },
];

export const NUTRIENT_BADGE_MAP = {
  N: { label: 'Nitrógeno', class: 'badge-n', color: '#2563eb' },
  'N-P': { label: 'Nitrógeno-Fósforo', class: 'badge-np', color: '#9333ea' },
  K: { label: 'Potasio', class: 'badge-k', color: '#d97706' },
  Sec: { label: 'Secundarios (Ca/Mg/S)', class: 'badge-sec', color: '#0d9488' },
  Fol: { label: 'Foliar / Micronutrientes', class: 'badge-fol', color: '#0284c7' },
  Corr: { label: 'Enmienda / Corrector', class: 'badge-corr', color: '#6b7280' },
  Org: { label: 'Orgánico', class: 'badge-org', color: '#16a34a' },
};
