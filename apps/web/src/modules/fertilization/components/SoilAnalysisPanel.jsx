import React from 'react';
import { FlaskConical, ChevronRight, Eye } from 'lucide-react';

/**
 * Formats an ISO date for display in Spanish short format.
 * "2026-07-15" → "15 jul 2026"
 */
function formatDate(isoDate) {
  try {
    const date = new Date(isoDate + 'T12:00:00');
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * SoilAnalysisItem — single soil analysis record.
 */
const SoilAnalysisItem = React.memo(function SoilAnalysisItem({ analysis, onView }) {
  return (
    <div className="fert-soil-item">
      <div className="fert-soil-item__info">
        <div className="fert-soil-item__lot">{analysis.lotName}</div>
        <div className="fert-soil-item__meta">
          {analysis.crop} · {formatDate(analysis.analysisDate)}
        </div>
      </div>
      <div className="fert-soil-item__right">
        <span className="fert-badge fert-badge--success">Óptimo</span>
        <button
          className="fert-btn fert-btn--ghost fert-btn--icon"
          onClick={() => onView?.(analysis)}
          aria-label={`Ver análisis de suelo de ${analysis.lotName}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
});

/**
 * SoilAnalysisPanel
 * Right column — recent soil analyses card.
 *
 * @param {array}    soilAnalysis - from the hook
 * @param {function} onViewAll    - callback for "Ver todos" button
 * @param {function} onViewItem   - callback for individual item arrow
 */
function SoilAnalysisPanel({ soilAnalysis = [], onViewAll, onViewItem }) {
  return (
    <div className="fert-card fert-card--static">
      <div className="fert-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={16} style={{ color: '#6B7280' }} aria-hidden="true" />
          <span className="fert-panel-title">Análisis de Suelos Recientes</span>
        </div>
        <button
          className="fert-btn fert-btn--ghost"
          onClick={onViewAll}
          aria-label="Ver todos los análisis de suelo"
          style={{ fontSize: 13, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Eye size={14} />
          Ver todos
        </button>
      </div>

      <div className="fert-soil-list">
        {soilAnalysis.map((analysis) => (
          <SoilAnalysisItem
            key={analysis.id}
            analysis={analysis}
            onView={onViewItem}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(SoilAnalysisPanel);
