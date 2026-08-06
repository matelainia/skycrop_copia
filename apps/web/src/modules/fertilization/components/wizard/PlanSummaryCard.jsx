import { formatCOP } from '../../../../utils/format.js';


export function PlanSummaryCard({ data, totalBudget }) {
  const { general, crop, applications } = data;

  return (
    <div className="plan-summary-card">
      <div className="summary-card-header">
        <span className="icon">🕒</span>
        <h4>Resumen del plan</h4>
      </div>

      <div className="summary-list">
        <div className="summary-item">
          <span className="label">Plan</span>
          <span className="value bold">{general.name || '—'}</span>
        </div>
        <div className="summary-item">
          <span className="label">Cultivo</span>
          <span className="value">
            {crop.cropName || '—'} · {crop.stage || '—'}
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Lote / Área</span>
          <span className="value">
            {general.lotName || '—'} / {general.area || 0} ha
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Aplicaciones</span>
          <span className="value bold">{applications.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Presupuesto</span>
          <span className="value bold text-green">{formatCOP(totalBudget)}</span>
        </div>
      </div>
    </div>
  );
}
