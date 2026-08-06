/**
 * PlanDetailNextApplication.jsx
 * Tarjeta: Próxima aplicación pendiente del plan.
 */
import React from 'react';
import { Clock } from 'lucide-react';

export default function PlanDetailNextApplication({ nextApp, onComplete, mutating }) {
  if (!nextApp) {
    return (
      <div className="pd-card sc-animate-fade-up" aria-label="Próxima aplicación">
        <div className="pd-card__header">
          <h2 className="pd-card__title"><Clock size={15} aria-hidden="true" />Próxima Aplicación</h2>
        </div>
        <div className="pd-empty">
          <div className="pd-empty__icon"><Clock size={20} /></div>
          <span className="pd-empty__title">Sin aplicaciones pendientes</span>
          <span className="pd-empty__desc">Todas las aplicaciones fueron completadas.</span>
        </div>
      </div>
    );
  }

  const scheduledDate = nextApp.scheduled_date
    ? new Date(nextApp.scheduled_date + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : '—';

  // Días restantes
  const daysLeft = nextApp.scheduled_date
    ? Math.ceil((new Date(nextApp.scheduled_date + 'T00:00:00') - new Date()) / 86400000)
    : null;

  return (
    <div className="pd-card sc-animate-fade-up" aria-label="Próxima aplicación pendiente">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <Clock size={15} aria-hidden="true" />
          Próxima Aplicación
        </h2>
      </div>
      <div className="pd-card__body">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--pd-text)' }}>
            {nextApp.product_name || 'Aplicación'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--pd-secondary)' }}>
            <Clock size={13} aria-hidden="true" />
            {scheduledDate}
            {daysLeft !== null && daysLeft >= 0 && (
              <span style={{
                marginLeft:4, fontSize:11, fontWeight:600,
                color: daysLeft <= 3 ? 'var(--pd-warning)' : 'var(--pd-primary)',
                background: daysLeft <= 3 ? 'var(--pd-warning-bg)' : 'var(--pd-success-bg)',
                padding:'2px 7px', borderRadius:999,
              }}>
                {daysLeft === 0 ? 'Hoy' : daysLeft === 1 ? 'Mañana' : `En ${daysLeft} días`}
              </span>
            )}
          </div>

          <button
            className="pd-btn pd-btn--primary"
            style={{ marginTop:8, width:'100%', justifyContent:'center' }}
            onClick={() => onComplete(nextApp.id, {})}
            disabled={mutating}
            id="next-app-complete-btn"
          >
            Marcar como realizada
          </button>
        </div>
      </div>
    </div>
  );
}
