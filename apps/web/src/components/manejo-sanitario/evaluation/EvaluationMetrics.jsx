import React from 'react';
import { Activity } from 'lucide-react';

/**
 * EvaluationMetrics
 * Tarjeta de indicadores con progress bars y badges.
 *
 * @param {{ variables: number, completadas: number, hallazgos: number, cobertura: number }} props
 */
const EvaluationMetrics = ({ variables = 0, completadas = 0, hallazgos = 0, cobertura = 0 }) => {
  const pctCompletadas = variables > 0 ? Math.round((completadas / variables) * 100) : 0;
  const pctHallazgos   = variables > 0 ? Math.round((hallazgos / variables) * 100) : 0;

  const barColor = (pct) => {
    if (pct >= 80) return 'var(--primary)';
    if (pct >= 50) return 'var(--accent-gold)';
    return 'var(--accent-red)';
  };

  const rows = [
    {
      label: 'Variables completadas',
      value: `${completadas} / ${variables}`,
      pct: pctCompletadas,
      color: barColor(pctCompletadas),
    },
    {
      label: 'Con hallazgos',
      value: hallazgos,
      pct: pctHallazgos,
      color: hallazgos > 0 ? 'var(--accent-gold)' : 'var(--primary)',
    },
    {
      label: 'Cobertura evaluada',
      value: `${cobertura}%`,
      pct: cobertura,
      color: barColor(cobertura),
    },
  ];

  return (
    <div className="eval-side-card">
      <div className="eval-side-card-header">
        <div className="eval-side-icon">
          <Activity size={14} color="var(--primary)" />
        </div>
        <span className="eval-side-title">Indicadores</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row, i) => (
          <div key={i} className="eval-progress-row">
            <div className="eval-progress-labels">
              <span className="eval-progress-lbl">{row.label}</span>
              <span className="eval-progress-val" style={{ color: row.color }}>
                {row.value}
              </span>
            </div>
            <div className="eval-progress-bar-track">
              <div
                className="eval-progress-bar-fill"
                style={{ width: `${row.pct}%`, background: row.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EvaluationMetrics;
