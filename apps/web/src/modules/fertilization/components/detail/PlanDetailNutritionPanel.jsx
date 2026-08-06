/**
 * PlanDetailNutritionPanel.jsx
 * Panel de estado nutricional (último análisis foliar).
 */
import React from 'react';
import { FlaskConical } from 'lucide-react';

const STATUS_CONFIG = {
  optimal: { label: 'Óptimo', cls: 'pd-nutrient-status--optimal', barCls: 'pd-nutrient-bar-fill--optimal', symCls: '' },
  low: { label: 'Bajo', cls: 'pd-nutrient-status--low', barCls: 'pd-nutrient-bar-fill--low', symCls: 'pd-nutrient-symbol--low' },
  high: { label: 'Alto', cls: 'pd-nutrient-status--high', barCls: 'pd-nutrient-bar-fill--high', symCls: 'pd-nutrient-symbol--high' },
};

function NutrientRow({ nutrient }) {
  const cfg = STATUS_CONFIG[nutrient.status] || STATUS_CONFIG.optimal;
  const max = nutrient.target_max || nutrient.value * 1.5 || 5;
  const pct = Math.min(100, ((nutrient.value || 0) / max) * 100);

  return (
    <div className="pd-nutrient-row" role="row">
      <div className={`pd-nutrient-symbol ${cfg.symCls}`} aria-hidden="true">
        {nutrient.element_code}
      </div>
      <span className="pd-nutrient-name" aria-label={nutrient.element_name || nutrient.element_code}>
        {nutrient.element_name || nutrient.element_code}
      </span>
      <div
        className="pd-nutrient-bar-track"
        role="progressbar"
        aria-valuenow={nutrient.value}
        aria-valuemin={nutrient.target_min ?? 0}
        aria-valuemax={max}
        aria-label={`${nutrient.element_name}: ${nutrient.value}${nutrient.unit || '%'}`}
      >
        <div
          className={`pd-nutrient-bar-fill sc-progress-bar ${cfg.barCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="pd-nutrient-value">{nutrient.value}{nutrient.unit || '%'}</span>
      <span className={`pd-nutrient-status ${cfg.cls}`}>{cfg.label}</span>
    </div>
  );
}

export default function PlanDetailNutritionPanel({ nutrition = [], lastAnalysisDate }) {
  const dateLabel = lastAnalysisDate
    ? new Date(lastAnalysisDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : null;

  if (!nutrition || nutrition.length === 0) {
    return (
      <div className="pd-card sc-animate-fade-up" aria-label="Estado nutricional">
        <div className="pd-card__header">
          <h2 className="pd-card__title"><FlaskConical size={15} aria-hidden="true" />Estado Nutricional</h2>
        </div>
        <div className="pd-empty">
          <div className="pd-empty__icon"><FlaskConical size={20} /></div>
          <span className="pd-empty__title">Sin análisis foliar</span>
          <span className="pd-empty__desc">Registra una observación de tipo "Análisis Foliar" para ver el estado nutricional.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-card sc-animate-fade-up" aria-label="Estado nutricional del plan">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <FlaskConical size={15} aria-hidden="true" />
          Estado Nutricional
        </h2>
        {dateLabel && <span className="pd-card__meta">Foliar · {dateLabel}</span>}
      </div>

      <div className="pd-card__body">
        <div className="pd-nutrition-list" role="table" aria-label="Valores nutricionales">
          {nutrition.map(n => (
            <NutrientRow key={n.element_code} nutrient={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
