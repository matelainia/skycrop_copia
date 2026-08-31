/**
 * formatSoilAnalysis.js
 * Helpers de formato para Análisis de Suelos
 */

export function formatFileSize(bytes) {
  if (bytes == null || isNaN(Number(bytes))) return '—';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateLong(iso) {
  if (!iso) return '—';
  try {
    const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso) {
  if (!iso) return '—';
  try {
    const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatAccuracy(m) {
  if (m == null) return '—';
  return `±${Number(m).toFixed(0)} m`;
}

export function daysAgo(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Hace 1 día';
    if (diff < 30) return `Hace ${diff} días`;
    if (diff < 365) return `Hace ${Math.floor(diff / 30)} meses`;
    return `Hace ${Math.floor(diff / 365)} años`;
  } catch {
    return '';
  }
}
