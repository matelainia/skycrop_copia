/**
 * PlanDetailHeader.jsx
 * Cabecera del plan: icono, nombre, código, versión, estado, progreso circular,
 * botón "Atrás" y botón "Exportar PDF".
 */
import React from 'react';
import { FileText, ArrowLeft, Download, ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  active:    { label: 'En ejecución', cls: 'pdh__badge--active' },
  draft:     { label: 'Borrador',     cls: 'pdh__badge--draft'  },
  paused:    { label: 'Pausado',      cls: 'pdh__badge--paused' },
  completed: { label: 'Completado',   cls: 'pdh__badge--completed' },
  archived:  { label: 'Archivado',    cls: 'pdh__badge--archived'  },
};

/** Mini SVG de progreso circular */
function ProgressRing({ pct = 0, size = 72, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="pdh__progress-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--pd-border, #e5e7eb)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke="var(--pd-primary, #15803d)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
        <text
          x="50%" y="50%"
          dominantBaseline="central" textAnchor="middle"
          fontSize={size * 0.2} fontWeight="700"
          fill="var(--pd-text, #1a1a1a)"
        >
          {pct}%
        </text>
      </svg>
      <span className="pdh__progress-ring-label">Avance del plan</span>
    </div>
  );
}

export default function PlanDetailHeader({ plan, onBack, onExportPdf, exporting }) {
  const status = STATUS_CONFIG[plan?.status] || STATUS_CONFIG.draft;
  const updatedAt = plan?.updated_at
    ? new Date(plan.updated_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <header className="plan-detail__header sc-animate-fade-in" role="banner">
      <div className="pdh__left">
        <div className="pdh__icon" aria-hidden="true">
          <FileText size={22} />
        </div>

        <div className="pdh__info">
          {/* Breadcrumb */}
          <nav className="pdh__breadcrumb" aria-label="Navegación">
            <button className="pdh__breadcrumb-btn" onClick={onBack} aria-label="Volver a Fertilización">
              Fertilización
            </button>
            <ChevronRight size={12} aria-hidden="true" />
            <span>Plan de Fertilización</span>
          </nav>

          {/* Nombre del plan */}
          <h1 className="pdh__name" title={plan?.name}>
            {plan?.name || 'Cargando plan…'}
            {plan?.version && (
              <span className="pdh__badge pdh__badge--draft" style={{ fontSize:11, marginLeft:8, verticalAlign:'middle' }}>
                {plan.version}
              </span>
            )}
          </h1>

          {/* Meta row */}
          <div className="pdh__meta-row">
            <span className={`pdh__badge ${status.cls}`}>
              <span className="sc-alert-dot" style={{ width:6, height:6, borderRadius:'50%', display:'inline-block', background:'currentColor' }} aria-hidden="true" />
              {status.label}
            </span>
            {plan?.code && (
              <span className="pdh__meta-item">
                <FileText size={12} aria-hidden="true" />
                {plan.code}
              </span>
            )}
            {plan?.lot_name && (
              <span className="pdh__meta-item">
                {plan.lot_name}
                {plan?.sector_name && ` · ${plan.sector_name}`}
              </span>
            )}
            {plan?.crop_name && (
              <span className="pdh__meta-item" style={{ fontStyle:'italic' }}>
                {plan.crop_name}
                {plan?.crop_scientific && ` (${plan.crop_scientific})`}
              </span>
            )}
            {plan?.phenological_stage && (
              <span className="pd-stage-badge">{plan.phenological_stage}</span>
            )}
            {plan?.period_label && (
              <span className="pdh__meta-item">{plan.period_label}</span>
            )}
            {plan?.responsible_name && (
              <span className="pdh__meta-item">{plan.responsible_name}</span>
            )}
            {updatedAt && (
              <span className="pdh__meta-item" style={{ fontSize:11 }}>
                actualizado hoy, {updatedAt.split(',')[1]?.trim()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Derecha: Progreso + acciones */}
      <div className="pdh__right">
        <ProgressRing pct={plan?.progressPct ?? 0} />

        <button
          className="pd-btn pd-btn--ghost"
          onClick={onBack}
          id="plan-detail-back-btn"
          aria-label="Volver al listado de planes"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver
        </button>

        <button
          className="pd-btn pd-btn--primary"
          onClick={onExportPdf}
          disabled={exporting}
          id="plan-detail-export-pdf-btn"
          aria-label="Exportar plan a PDF"
        >
          <Download size={16} aria-hidden="true" />
          {exporting ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>
    </header>
  );
}
