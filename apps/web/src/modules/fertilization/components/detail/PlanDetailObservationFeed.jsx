/**
 * PlanDetailObservationFeed.jsx
 * Feed de observaciones de campo para el plan.
 * Incluye el formulario inline de registro y filtros por tipo.
 */
import React, { useState, useMemo } from 'react';
import { MessageSquare, PlusCircle } from 'lucide-react';
import PlanDetailObservationCard from './PlanDetailObservationCard.jsx';
import PlanDetailObservationInlineForm from './PlanDetailObservationInlineForm.jsx';

const FILTERS = [
  { key: 'all',            label: 'Todas' },
  { key: 'note',           label: 'Notas' },
  { key: 'symptom',        label: 'Síntomas' },
  { key: 'foliar_analysis',label: 'Análisis' },
  { key: 'application',   label: 'Aplicaciones' },
  { key: 'climate',       label: 'Clima' },
  { key: 'soil',          label: 'Suelo' },
];

export default function PlanDetailObservationFeed({ observations = [], onAddComment, onSaveObservation, mutating }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return observations;
    return observations.filter(o => o.observation_type === activeFilter);
  }, [observations, activeFilter]);

  const handleFocusForm = () => {
    const textarea = document.getElementById('obs-content-input');
    if (textarea) {
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textarea.focus();
    }
  };

  return (
    <section className="pd-card sc-animate-fade-up" aria-label="Observaciones de campo">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <MessageSquare size={15} aria-hidden="true" />
          Observaciones de Campo
        </h2>
        <button
          className="pd-btn pd-btn--primary"
          style={{ padding:'6px 12px', fontSize:12 }}
          onClick={handleFocusForm}
          id="new-observation-btn"
          aria-label="Registrar nueva observación"
        >
          <PlusCircle size={14} aria-hidden="true" />
          Nueva
        </button>
      </div>

      {/* Bloque Inline Form para nueva observación */}
      <PlanDetailObservationInlineForm
        onSave={onSaveObservation}
        mutating={mutating}
      />

      {/* Filtros */}
      <div
        style={{
          display:'flex', gap:6, padding:'8px 20px',
          borderBottom:'1px solid var(--pd-border)', overflowX:'auto',
          scrollbarWidth:'none',
        }}
        role="tablist"
        aria-label="Filtrar observaciones por tipo"
      >
        {FILTERS.map(f => {
          const count = f.key === 'all' ? observations.length : observations.filter(o => o.observation_type === f.key).length;
          if (count === 0 && f.key !== 'all') return null;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={activeFilter === f.key}
              className="pd-btn pd-btn--ghost"
              style={{
                fontSize:11, padding:'4px 10px', borderRadius:999,
                fontWeight: activeFilter === f.key ? 700 : 500,
                background: activeFilter === f.key ? 'var(--pd-success-bg)' : undefined,
                color: activeFilter === f.key ? 'var(--pd-primary)' : undefined,
                borderColor: activeFilter === f.key ? 'var(--pd-primary)' : undefined,
                flexShrink: 0,
              }}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
              {count > 0 && (
                <span style={{
                  marginLeft:4, fontSize:10,
                  background: activeFilter === f.key ? 'var(--pd-primary)' : 'var(--pd-border)',
                  color: activeFilter === f.key ? '#fff' : 'var(--pd-muted)',
                  padding:'0 5px', borderRadius:999,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feed */}
      <div className="pd-card__body">
        {filtered.length === 0 ? (
          <div className="pd-empty">
            <div className="pd-empty__icon"><MessageSquare size={20} /></div>
            <span className="pd-empty__title">Sin observaciones</span>
            <span className="pd-empty__desc">
              {activeFilter === 'all'
                ? 'Registra la primera observación del plan.'
                : `No hay observaciones de tipo "${FILTERS.find(f => f.key === activeFilter)?.label}".`}
            </span>
          </div>
        ) : (
          <div className="pd-obs-feed sc-stagger" role="feed" aria-label={`${filtered.length} observaciones`}>
            {filtered.map(obs => (
              <PlanDetailObservationCard
                key={obs.id}
                observation={obs}
                onAddComment={onAddComment}
                mutating={mutating}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

