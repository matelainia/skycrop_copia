/**
 * StatusBadge.jsx  ·  components/common/
 * Motor reutilizable de badges de estado para todo SkyCrop.
 *
 * Uso:
 *   <StatusBadge status="active"    type="validity" />   → "Vigente"   (verde)
 *   <StatusBadge status="expired"   type="validity" />   → "Expirado"  (rojo)
 *   <StatusBadge status="running"   type="plan"     />   → "En ejecución" (azul)
 *   <StatusBadge status="draft"     type="plan"     />   → "Borrador"  (gris)
 *   <StatusBadge status="completed" type="plan"     />   → "Completado" (verde-gris)
 *
 * @param {string} status   - Valor del estado (key)
 * @param {'plan'|'validity'|'execution'} [type='plan'] - Tipo de estado
 * @param {string} [className] - Clases adicionales
 */
import React from 'react';

// ── Configuración por tipo y estado ──────────────────────────────────────────
const CONFIG = {
  plan: {
    draft:     { label: 'Borrador',      variant: 'status-badge--draft' },
    running:   { label: 'En ejecución',  variant: 'status-badge--running' },
    completed: { label: 'Completado',    variant: 'status-badge--completed' },
    archived:  { label: 'Archivado',     variant: 'status-badge--archived' },
  },
  validity: {
    active:    { label: 'Vigente',       variant: 'status-badge--valid-active' },
    scheduled: { label: 'Programado',    variant: 'status-badge--valid-scheduled' },
    expired:   { label: 'Expirado',      variant: 'status-badge--valid-expired' },
    suspended: { label: 'Suspendido',    variant: 'status-badge--valid-suspended' },
  },
  execution: {
    pending:   { label: 'Pendiente',     variant: 'status-badge--exec-pending' },
    inprogress:{ label: 'En curso',      variant: 'status-badge--exec-inprogress' },
    done:      { label: 'Ejecutado',     variant: 'status-badge--exec-done' },
    failed:    { label: 'Fallido',       variant: 'status-badge--exec-failed' },
  },
};

const StatusBadge = React.memo(function StatusBadge({ status, type = 'plan', className = '' }) {
  const config = CONFIG[type]?.[status];
  if (!config) {
    return (
      <span className={`status-badge status-badge--unknown ${className}`}>
        {status}
      </span>
    );
  }
  return (
    <span className={`status-badge ${config.variant} ${className}`}>
      {config.label}
    </span>
  );
});

export default StatusBadge;
