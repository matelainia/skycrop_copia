import React from 'react';
import { Leaf, MapPin, User, Tag, Calendar } from 'lucide-react';
import EvidenceGallery from './EvidenceGallery';
import EvaluationMetrics from './EvaluationMetrics';
import ValidationChecklist from './ValidationChecklist';
import ReviewButton from './ReviewButton';

/**
 * EvaluationSummary
 * Panel lateral completo con 4 tarjetas:
 * 1. Resumen del lote y evaluación
 * 2. Indicadores de evaluación
 * 3. Evidencias
 * 4. Validaciones + CTA Revisión
 *
 * @param {{
 *   lote: Object,
 *   tipoEvaluacion: string,
 *   fecha: string,
 *   responsable: string,
 *   variables: number,
 *   completadas: number,
 *   hallazgos: number,
 *   cobertura: number,
 *   allPhotos: string[],
 *   validations: Array<{label: string, done: boolean}>,
 *   ready: boolean,
 *   onReview: () => void,
 *   onPhotoPreview: (idx: number) => void
 * }} props
 */
const EvaluationSummary = ({
  lote,
  tipoEvaluacion = 'Fitosanitario',
  fecha,
  responsable,
  variables = 0,
  completadas = 0,
  hallazgos = 0,
  cobertura = 0,
  allPhotos = [],
  validations = [],
  ready = false,
  onReview,
  onPhotoPreview,
}) => {
  const tipoBadgeColor = {
    Fitosanitario: 'green',
    Productivo: 'blue',
    Enfermedades: 'purple',
    Personalizado: 'orange',
  }[tipoEvaluacion] || 'gray';

  return (
    <div className="eval-side-col">

      {/* ── Tarjeta 1: Resumen de la evaluación ── */}
      <div className="eval-side-card">
        <div className="eval-side-card-header">
          <div className="eval-side-icon">
            <Leaf size={14} color="var(--primary)" />
          </div>
          <span className="eval-side-title">Información de la evaluación</span>
        </div>

        {/* Lote preview */}
        <div className="eval-lote-preview">
          <div className="eval-lote-thumb">🌿</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {lote?.nombre || lote?.codigo_interno || 'Lote sin nombre'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {lote?.area_ha ? `${lote.area_ha} ha` : '—'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eval-summary-row">
            <span className="eval-summary-label">
              <Tag size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Tipo
            </span>
            <span className={`eval-badge ${tipoBadgeColor}`}>{tipoEvaluacion}</span>
          </div>

          <div className="eval-summary-row">
            <span className="eval-summary-label">
              <Calendar size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Fecha
            </span>
            <span className="eval-summary-value">
              {fecha
                ? new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'
              }
            </span>
          </div>

          <div className="eval-summary-row">
            <span className="eval-summary-label">
              <User size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Responsable
            </span>
            <span className="eval-summary-value" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {responsable || '—'}
            </span>
          </div>

          <div className="eval-summary-row">
            <span className="eval-summary-label">
              <MapPin size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Estado
            </span>
            <span className="eval-badge orange">Pendiente</span>
          </div>
        </div>
      </div>

      {/* ── Tarjeta 2: Indicadores ── */}
      <EvaluationMetrics
        variables={variables}
        completadas={completadas}
        hallazgos={hallazgos}
        cobertura={cobertura}
      />

      {/* ── Tarjeta 3: Evidencias ── */}
      <div className="eval-side-card">
        <div className="eval-side-card-header">
          <div className="eval-side-icon">📷</div>
          <span className="eval-side-title">Evidencia fotográfica</span>
          <span className="eval-badge gray" style={{ marginLeft: 'auto' }}>
            {allPhotos.length} foto{allPhotos.length !== 1 ? 's' : ''}
          </span>
        </div>

        <EvidenceGallery
          photos={allPhotos}
          onPreview={onPhotoPreview}
        />
      </div>

      {/* ── Tarjeta 4: Validaciones ── */}
      <div className="eval-side-card">
        <div className="eval-side-card-header">
          <div className="eval-side-icon">✅</div>
          <span className="eval-side-title">Validaciones</span>
        </div>

        <ValidationChecklist items={validations} />
      </div>

      {/* ── CTA: Ir a revisión ── */}
      <ReviewButton ready={ready} onClick={onReview} />

    </div>
  );
};

export default EvaluationSummary;
