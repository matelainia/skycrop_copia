/**
 * PlanDetailGeneralInfo.jsx
 * Tarjeta de información general del lote/cultivo del plan.
 */
import React from 'react';
import { MapPin } from 'lucide-react';

function Field({ label, value, badge }) {
  return (
    <div className="pd-field">
      <span className="pd-field__label">{label}</span>
      <span className="pd-field__value">
        {badge
          ? <span className="pd-stage-badge">{value || '—'}</span>
          : (value || '—')
        }
      </span>
    </div>
  );
}

export default function PlanDetailGeneralInfo({ plan }) {
  const period = plan?.period_label ||
    (plan?.start_date && plan?.end_date
      ? `${new Date(plan.start_date + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })} — ${new Date(plan.end_date + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}`
      : null);

  const createdAt = plan?.created_at
    ? new Date(plan.created_at).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })
    : null;

  return (
    <section className="pd-card sc-animate-fade-up" aria-label="Información general del plan">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <MapPin size={15} aria-hidden="true" />
          Información General
        </h2>
        {period && <span className="pd-card__meta">{period}</span>}
      </div>

      <div className="pd-card__body">
        <div className="pd-general-grid">
          <Field label="Predio / Lote" value={plan?.lot_name} />
          <Field label="Sector"        value={plan?.sector_name} />
          <Field label="Área"          value={plan?.area_ha ? `${plan.area_ha} ha` : null} />
          <Field label="Cultivo"       value={
            plan?.crop_name
              ? `${plan.crop_name}${plan?.crop_scientific ? ` (${plan.crop_scientific})` : ''}`
              : null
          } />
          <Field label="Etapa Fenológica" value={plan?.phenological_stage} badge />
          <Field label="Densidad"      value={plan?.density} />
          <Field label="Responsable"   value={plan?.responsible_name} />
          <Field label="Fecha Creación" value={createdAt} />
          <Field label="Suelo"         value={plan?.soil_type} />
        </div>

        {plan?.notes && (
          <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(0,0,0,0.02)', borderRadius:10, fontSize:13, color:'var(--pd-secondary)', lineHeight:1.55 }}>
            {plan.notes}
          </div>
        )}
      </div>
    </section>
  );
}
