export const CATEGORIES = [
  'Semillas',
  'Fertilizantes',
  'Herbicidas',
  'Pesticidas',
  'Mantenimiento',
  'Seguridad',
  'Herramientas'
];

export const UNITS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'sacos', label: 'Sacos' }
];

export const ITEMS_PER_PAGE = 7;

export const DEFAULT_NEW_ITEM = {
  name: '',
  category: 'Semillas',
  quantity: '',
  unit: 'kg',
  minQuantity: '',
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
  categoria: 'Agroquímicos',
  categoriaOtro: '',
  responsableId: ''
};
