import { memo } from 'react';
import { APP_STATUS_LABELS } from '../../types/aplicaciones.types.js';

const STATUS_CLASS_MAP = {
  pending: 'status-badge--pending',
  completed: 'status-badge--completed',
  skipped: 'status-badge--skipped',
  rescheduled: 'status-badge--rescheduled',
};

export const ApplicationStatusBadge = memo(function ApplicationStatusBadge({ status, label }) {
  const normalized = String(status || '').toLowerCase();
  const variant = STATUS_CLASS_MAP[normalized] || 'status-badge--unknown';
  const text = label || APP_STATUS_LABELS[normalized] || status || '—';
  return <span className={`status-badge ${variant}`}>{text}</span>;
});

const PHASE_VARIANT_MAP = {
  'floración': 'phenology-badge--floracion',
  'fructificación': 'phenology-badge--fructificacion',
  'fructificacion': 'phenology-badge--fructificacion',
  'desarrollo de frutos': 'phenology-badge--llenado',
  'desarrollo vegetativo': 'phenology-badge--vegetativo',
  'vegetativo': 'phenology-badge--vegetativo',
  'llenado': 'phenology-badge--llenado',
  'llenado de fruto': 'phenology-badge--llenado',
  'llenado de mazorca': 'phenology-badge--llenado',
  'maduración': 'phenology-badge--maduracion',
  'maduracion': 'phenology-badge--maduracion',
  'madurez': 'phenology-badge--maduracion',
  'producción': 'phenology-badge--produccion',
  'produccion': 'phenology-badge--produccion',
  'establecimiento': 'phenology-badge--vegetativo',
  'cherelle': 'phenology-badge--fructificacion',
  'emisión': 'phenology-badge--emision',
  'emision': 'phenology-badge--emision',
  'renovación': 'phenology-badge--renovacion',
};

function getPhaseVariant(phase) {
  if (!phase) return 'phenology-badge--default';
  const key = String(phase).trim().toLowerCase();
  return PHASE_VARIANT_MAP[key] || 'phenology-badge--default';
}

export const PhenologyBadgeFert = memo(function PhenologyBadgeFert({ phase }) {
  if (!phase || phase === '—') return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>;
  const variant = getPhaseVariant(phase);
  return <span className={`phenology-badge ${variant}`}>{phase}</span>;
});
