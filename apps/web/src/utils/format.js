/**
 * Utility functions for currency and date formatting across SkyCrop
 */

/**
 * Formats a number to Colombian Pesos (COP)
 * @param {number} amount - Amount in COP
 * @returns {string} Formatted currency string (e.g., "$ 1.350.000")
 */
export function formatCOP(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats an ISO date string to Spanish short date (e.g., "12 Ago 2026")
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateES(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
