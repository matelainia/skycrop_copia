// Estado de stock DERIVADO (contrato-v2 §1). Única fuente para UI y filtros.
// No se almacena en DB: se calcula desde quantity / minQuantity / maxQuantity.
export const STOCK_STATUS = {
  agot:  { label: 'Agotado',    color: '#dc2626', bg: 'var(--accent-red-light, #fee2e2)' },
  crit:  { label: 'Crítico',    color: '#d97706', bg: '#fef3c7' },
  bajo:  { label: 'Bajo',       color: '#d97706', bg: '#fef3c7' },
  opt:   { label: 'Óptimo',     color: '#16a34a', bg: 'var(--primary-light)' },
  sobre: { label: 'Sobrestock', color: '#2563eb', bg: '#dbeafe' },
};

export function getStockStatus(item = {}) {
  const q = Number(item.quantity) || 0;
  const min = Number(item.minQuantity) || 0;
  const max = item.maxQuantity === null || item.maxQuantity === undefined || item.maxQuantity === ''
    ? null
    : Number(item.maxQuantity);

  if (q === 0) return 'agot';
  if (max !== null && !Number.isNaN(max) && q > max) return 'sobre';
  if (q < min) return q < min * 0.5 ? 'crit' : 'bajo';
  return 'opt';
}

export function isAlertStatus(status) {
  return status === 'crit' || status === 'agot';
}

export function getStatusMeta(status) {
  return STOCK_STATUS[status] || STOCK_STATUS.opt;
}
