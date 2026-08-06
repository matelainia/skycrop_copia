/**
 * PlanDetailActiveAlerts.jsx
 * Tarjeta de alertas activas del plan.
 */
import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const SEV_CONFIG = {
  critical: { icon: AlertCircle, cls: 'pd-alert-item--high',   iconColor:'var(--pd-danger)',  label:'Crítica' },
  high:     { icon: AlertCircle, cls: 'pd-alert-item--high',   iconColor:'var(--pd-danger)',  label:'Alta'    },
  medium:   { icon: AlertTriangle, cls:'pd-alert-item--medium',iconColor:'var(--pd-warning)', label:'Media'   },
  low:      { icon: Info,       cls: 'pd-alert-item--low',     iconColor:'var(--pd-info)',    label:'Baja'    },
};

export default function PlanDetailActiveAlerts({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div className="pd-card sc-animate-fade-up" aria-label="Alertas activas">
        <div className="pd-card__header">
          <h2 className="pd-card__title"><AlertTriangle size={15} aria-hidden="true" />Alertas Activas</h2>
        </div>
        <div className="pd-empty">
          <div className="pd-empty__icon" style={{ background:'var(--pd-success-bg)', color:'var(--pd-success)' }}>
            <AlertTriangle size={20} />
          </div>
          <span className="pd-empty__title">Sin alertas activas</span>
          <span className="pd-empty__desc">Las alertas aparecen cuando una observación se marca como alerta.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-card sc-animate-fade-up" aria-label="Alertas activas del plan" aria-live="polite">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <AlertTriangle size={15} aria-hidden="true" />
          Alertas Activas
        </h2>
        <span className="pd-card__meta">{alerts.length}</span>
      </div>

      <div className="pd-card__body">
        <div className="pd-alert-list" role="list">
          {alerts.map(alert => {
            const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.medium;
            const Icon = cfg.icon;
            return (
              <div
                key={alert.id}
                className={`pd-alert-item ${cfg.cls} sc-animate-fade-up`}
                role="listitem"
                aria-label={`Alerta ${cfg.label}: ${alert.title}`}
              >
                <div className="pd-alert-icon" aria-hidden="true">
                  <Icon size={16} color={cfg.iconColor} />
                </div>
                <div className="pd-alert-content">
                  <div className="pd-alert-title">{alert.title}</div>
                  {alert.description && (
                    <div className="pd-alert-desc">{alert.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
