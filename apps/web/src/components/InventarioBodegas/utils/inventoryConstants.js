// D3 firmado 2026-09-17 (docs/inventario/catalogo-d3.md, migración 062).
// Único origen hasta tener endpoint/generador.
export const CATEGORIES = [
  'Fungicida',
  'Insecticida',
  'Herbicida',
  'Fertilizante',
  'Semilla',
  'Herramienta',
  'EPP',
  'Biológico',
  'Embalaje',
  'Repuesto',
  'Combustible',
  'Agroquímico'
];

export const WAREHOUSE_CATEGORIES = [
  'Herramientas',
  'Insumos Fitosanitarios',
  'Fertilizantes',
  'Semillas',
  'EPP',
  'Cosecha',
  'General',
  'Combustible'
];

export const UNITS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'sacos', label: 'Sacos' }
];

export const ITEMS_PER_PAGE = 8;

export const MOVEMENT_TYPES = ['entrada', 'salida', 'ajuste', 'transferencia'];

export const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos los Estados' },
  { value: 'alertas', label: 'Con alerta' },
  { value: 'opt', label: 'Óptimo' },
  { value: 'bajo', label: 'Bajo' },
  { value: 'crit', label: 'Crítico' },
  { value: 'agot', label: 'Agotado' },
  { value: 'sobre', label: 'Sobrestock' },
];

export const DEFAULT_NEW_ITEM = {
  name: '',
  category: 'Fertilizante',
  sku: '',
  quantity: '',
  unit: 'kg',
  minQuantity: '',
  maxQuantity: '',
  warehouseId: '',
  lote: '',
  registroIca: '',
  comentarios: ''
};

export const DEFAULT_NEW_WAREHOUSE = {
  nombre: '',
  sector: '',
  coordenadaX: '',
  coordenadaY: '',
  categoria: 'Insumos Fitosanitarios',
  categoriaOtro: '',
  responsableId: '',
  capacidad: ''
};
