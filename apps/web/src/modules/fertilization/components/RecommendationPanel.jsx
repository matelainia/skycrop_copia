import React from 'react';
import { Calendar } from 'lucide-react';

/**
 * Parses an ISO date string and returns { day, month } for display.
 * "2026-08-05" → { day: "05", month: "AGO" }
 */
function parseDateBlock(isoDate) {
  try {
    const date = new Date(isoDate + 'T12:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = date
      .toLocaleDateString('es-ES', { month: 'short' })
      .toUpperCase()
      .replace('.', '');
    return { day, month };
  } catch {
    return { day: '--', month: '---' };
  }
}

/**
 * Returns the CSS modifier class for a fertilizer chip.
 */
function getFertilizerClass(doseType = '') {
  const map = { npk: 'npk', urea: 'urea', kcl: 'kcl', dap: 'dap' };
  return map[doseType] ?? 'info';
}

/**
 * RecommendationItem — single upcoming recommendation row.
 * Memoized to avoid re-renders when other recommendations change.
 */
const RecommendationItem = React.memo(function RecommendationItem({ rec }) {
  const { day, month } = parseDateBlock(rec.date);
  const badgeClass = getFertilizerClass(rec.doseType);

  return (
    <div className="fert-rec-item">
      {/* Date block */}
      <div className="fert-rec-date" aria-label={`Fecha: ${day} de ${month}`}>
        <span className="fert-rec-date__day">{day}</span>
        <span className="fert-rec-date__month">{month}</span>
      </div>

      {/* Info */}
      <div className="fert-rec-body">
        <div className="fert-rec-body__lot">{rec.lotName}</div>
        <div className="fert-rec-body__meta">
          {rec.crop} • {rec.phenologicalPhase}
        </div>
        <span className={`fert-badge fert-badge--${badgeClass}`}>
          {rec.fertilizer}
        </span>
        <div className="fert-rec-body__dose">{rec.dose}</div>
      </div>
    </div>
  );
});

/**
 * RecommendationPanel
 * Right column — upcoming recommendations list.
 *
 * @param {array}    recommendations - from the hook
 * @param {function} onViewCalendar  - callback for "Ver calendario" button
 */
function RecommendationPanel({ recommendations = [], onViewCalendar }) {
  return (
    <div className="fert-card fert-card--static">
      <div className="fert-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} style={{ color: '#6B7280' }} aria-hidden="true" />
          <span className="fert-panel-title">Próximas Recomendaciones</span>
        </div>
        <button
          className="fert-btn fert-btn--ghost"
          onClick={onViewCalendar}
          aria-label="Ver calendario de recomendaciones"
          style={{ fontSize: 13, padding: '6px 10px' }}
        >
          Ver calendario
        </button>
      </div>

      <div className="fert-rec-list">
        {recommendations.map((rec) => (
          <RecommendationItem key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}

export default React.memo(RecommendationPanel);
