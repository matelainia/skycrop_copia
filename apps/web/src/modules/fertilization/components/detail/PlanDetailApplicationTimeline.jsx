/**
 * PlanDetailApplicationTimeline.jsx
 * Cronograma de aplicaciones con opción de marcar como realizada.
 */
import React, { useState } from 'react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';

function TimelineItem({ app, onComplete, mutating }) {
  const [note, setNote]     = useState('');
  const [expanded, setExpanded] = useState(false);
  const isCompleted = app.status === 'completed';
  const isPending   = app.status === 'pending';

  const scheduledDate = app.scheduled_date
    ? new Date(app.scheduled_date + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' })
    : '—';
  const completedDate = app.completed_date
    ? new Date(app.completed_date + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' })
    : null;

  return (
    <div className="pd-timeline-item">
      <div className={`pd-timeline-dot pd-timeline-dot--${isCompleted ? 'completed' : 'pending'}`} aria-hidden="true">
        {isCompleted ? <CheckCircle2 size={14} /> : (app.application_number || '?')}
      </div>

      <div className="pd-timeline-content">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
          <div>
            <div className="pd-timeline-product">{app.product_name || 'Aplicación'}</div>
            <div className="pd-timeline-date">
              {isCompleted
                ? `Realizada el ${completedDate || scheduledDate}`
                : `Programada para el ${scheduledDate}`
              }
              {app.dose_applied && (
                <span style={{ marginLeft:6, color:'var(--pd-primary)', fontSize:10, fontWeight:600 }}>
                  {app.dose_applied} {app.dose_unit}
                </span>
              )}
            </div>
          </div>

          {isPending && (
            <button
              className="pd-timeline-complete-btn"
              onClick={() => setExpanded(v => !v)}
              disabled={mutating}
              id={`complete-app-btn-${app.id}`}
              aria-expanded={expanded}
            >
              {expanded ? 'Cancelar' : 'Marcar como realizada'}
            </button>
          )}
        </div>

        {/* Mini form para completar */}
        {expanded && isPending && (
          <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
            <input
              className="pd-form-input"
              style={{ flex:1, minWidth:180 }}
              placeholder="Nota opcional (ej. clima, dosis real)"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              aria-label="Nota de completado"
            />
            <button
              className="pd-btn pd-btn--primary"
              disabled={mutating}
              onClick={() => {
                onComplete(app.id, { completionNote: note || null });
                setExpanded(false);
                setNote('');
              }}
              aria-label="Confirmar aplicación como realizada"
            >
              Confirmar
            </button>
          </div>
        )}

        {app.completion_note && isCompleted && (
          <div style={{ marginTop:4, fontSize:11, color:'var(--pd-muted)' }}>
            Nota: {app.completion_note}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanDetailApplicationTimeline({ applications = [], onComplete, mutating }) {
  if (applications.length === 0) {
    return (
      <section className="pd-card sc-animate-fade-up" aria-label="Cronograma de aplicaciones">
        <div className="pd-card__header">
          <h2 className="pd-card__title"><CalendarDays size={15} aria-hidden="true" />Cronograma de Aplicaciones</h2>
        </div>
        <div className="pd-empty">
          <div className="pd-empty__icon"><CalendarDays size={22} /></div>
          <span className="pd-empty__title">Sin aplicaciones programadas</span>
          <span className="pd-empty__desc">Las aplicaciones aparecerán aquí una vez programadas.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="pd-card sc-animate-fade-up" aria-label="Cronograma de aplicaciones">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <CalendarDays size={15} aria-hidden="true" />
          Cronograma de Aplicaciones
        </h2>
        <span className="pd-card__meta">
          {applications.filter(a => a.status === 'completed').length}/{applications.length} realizadas
        </span>
      </div>

      <div className="pd-card__body">
        <div className="pd-timeline" role="list" aria-label="Línea de tiempo de aplicaciones">
          {applications.map(app => (
            <TimelineItem
              key={app.id}
              app={app}
              onComplete={onComplete}
              mutating={mutating}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
