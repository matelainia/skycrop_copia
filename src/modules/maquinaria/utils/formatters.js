/**
 * Formatting utilities for dates, numbers, currency, and quantities
 */

/**
 * Format datetime to short Spanish locale string
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format date to day and short month
 */
export const formatDateShort = (dateStr) => {
  if (!dateStr) return '--';
  const date = new Date(dateStr + 'T12:00:00');
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

/**
 * Format numeric costs to standard currency
 */
export const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '--';
  return `$${Math.round(val).toLocaleString('es-ES')}`;
};

/**
 * Format operational hours
 */
export const formatHours = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.0 h';
  return `${val.toFixed(1)} h`;
};
