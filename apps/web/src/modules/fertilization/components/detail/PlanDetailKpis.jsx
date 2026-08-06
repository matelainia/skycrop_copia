/**
 * PlanDetailKpis.jsx
 * 4 (o 6) tarjetas KPI con stagger animation para la pantalla de detalle.
 */
import { LayoutList, MessageSquare, AlertTriangle, DollarSign } from 'lucide-react';

function KpiCard({ label, value, sub, icon: Icon, iconClass, delay = 0 }) {
  return (
    <div
      className="pd-kpi sc-animate-fade-up sc-card-hover"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <div className="pd-kpi__content">
        <span className="pd-kpi__label">{label}</span>
        <span className="pd-kpi__value">{value}</span>
        {sub && <span className="pd-kpi__sub">{sub}</span>}
      </div>
      {Icon && (
        <div className={`pd-kpi__icon ${iconClass}`} aria-hidden="true">
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

export default function PlanDetailKpis({ plan }) {
  const completed = plan?.applicationsCompleted ?? 0;
  const total     = plan?.applicationsTotal ?? 0;
  const pct       = plan?.progressPct ?? 0;
  const budget    = plan?.budgetTotal ?? 0;
  const executed  = plan?.budgetExecuted ?? 0;
  const currency  = plan?.currency || 'COP';

  const formatMoney = (n) =>
    new Intl.NumberFormat('es-CO', { style:'currency', currency, maximumFractionDigits:0 }).format(n);

  return (

    <section className="plan-detail__kpis" aria-label="Indicadores clave del plan">
      <KpiCard
        label="Aplicaciones"
        value={`${completed} / ${total}`}
        sub={
          <>
            <div className="pd-progress-track" style={{ flex:1, marginTop:0 }}>
              <div
                className="pd-progress-fill sc-progress-bar"
                style={{ width:`${total > 0 ? (completed / total) * 100 : 0}%` }}
              />
            </div>
            <span style={{ fontSize:10, marginLeft:4 }}>{pct}%</span>
          </>
        }
        icon={LayoutList}
        iconClass="pd-kpi__icon--green"
        delay={0}
      />
      <KpiCard
        label="Observaciones"
        value={plan?.observationsTotal ?? 0}
        sub={`${plan?.attachmentsTotal ?? 0} adjuntos de campo`}
        icon={MessageSquare}
        iconClass="pd-kpi__icon--blue"
        delay={40}
      />
      <KpiCard
        label="Alertas Activas"
        value={plan?.alertsActive ?? 0}
        sub={plan?.alertsActive > 0 ? 'Revisar alertas' : 'Sin alertas pendientes'}
        icon={AlertTriangle}
        iconClass={plan?.alertsActive > 0 ? 'pd-kpi__icon--orange' : 'pd-kpi__icon--green'}
        delay={80}
      />
      <KpiCard
        label="Inversión Ejecutada"
        value={formatMoney(executed)}
        sub={`de ${formatMoney(budget)} presupuestados`}
        icon={DollarSign}
        iconClass="pd-kpi__icon--purple"
        delay={120}
      />
    </section>
  );
}
