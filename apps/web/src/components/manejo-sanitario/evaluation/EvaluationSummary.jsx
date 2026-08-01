import React from 'react';
import { Leaf, MapPin, User, Tag, Calendar, Shield, BarChart3, AlertTriangle } from 'lucide-react';
import EvidenceGallery from './EvidenceGallery';
import EvaluationMetrics from './EvaluationMetrics';
import ValidationChecklist from './ValidationChecklist';
import ReviewButton from './ReviewButton';
import { EvaluationStateMachine } from './domain/services/EvaluationStateMachine';

/**
 * EvaluationSummary
 * Panel lateral completo con tarjetas dinámicas:
 * 1. Resumen del lote, objeto evaluado, categoría, protocolo y versión
 * 2. Indicadores de evaluación (cobertura, incidencia, severidad, nivel de riesgo)
 * 3. Alertas disparadas y recomendaciones
 * 4. Evidencia fotográfica
 * 5. Validaciones + CTA de revisión
 */
const EvaluationSummary = ({
  lote,
  tipoEvaluacion = 'Sanitario',
  objetoEvaluado,
  protocoloInfo,
  fecha,
  responsable,
  variables = 0,
  completadas = 0,
  hallazgos = 0,
  cobertura = 0,
  incidencia = 0,
  severidad = 0,
  riskLevel = 'Sin riesgo',
  evaluationStatus = 'BORRADOR',
  alerts = [],
  allPhotos = [],
  validations = [],
  ready = false,
  onReview,
  onPhotoPreview,
}) => {
  const stateInfo = EvaluationStateMachine.getStateInfo(evaluationStatus);

  const tipoBadgeColor = {
    Sanitario: 'green',
    Productivo: 'blue',
    Preventivo: 'purple',
    Seguimiento: 'orange',
  }[tipoEvaluacion] || 'green';

  const riskColors = {
    'Sin riesgo': { color: '#15803d', bg: 'rgba(21,128,61,0.12)' },
    'Bajo':       { color: '#15803d', bg: 'rgba(21,128,61,0.12)' },
    'Medio':      { color: '#a16207', bg: 'rgba(234,179,8,0.12)' },
    'Alto':       { color: '#c2410c', bg: 'rgba(249,115,22,0.12)' },
    'Crítico':    { color: '#dc2626', bg: 'rgba(220,38,38,0.12)' }
  };
  const rStyle = riskColors[riskLevel] || riskColors['Sin riesgo'];

  return (
    <div className="eval-side-col">

      {/* ── Tarjeta 1: Información de la evaluación ── */}
      <div className="eval-side-card">
        <div className="eval-side-card-header">
          <div className="eval-side-icon">
            <Leaf size={14} color="var(--primary)" />
          </div>
          <span className="eval-side-title">Información de la evaluación</span>
          <span style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
            padding: '2px 8px', borderRadius: 8,
            color: stateInfo.color || 'var(--primary)',
            background: stateInfo.bg || 'rgba(0,0,0,0.06)'
          }}>
            {stateInfo.icon} {stateInfo.label}
          </span>
        </div>

        {/* Lote preview */}
        <div className="eval-lote-preview">
          <div className="eval-lote-thumb">🌿</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {lote?.nombre || (lote?.codigo_interno ? `Lote ${lote.codigo_interno}` : 'Lote sin nombre')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {lote?.area_ha ? `${lote.area_ha} ha` : '—'}
              {(lote?.cultivo_ref?.nombre_comun || lote?.cultivo)
                ? ` · ${lote.cultivo_ref?.nombre_comun || lote.cultivo}` : ''}
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

          {objetoEvaluado && (
            <div className="eval-summary-row">
              <span className="eval-summary-label">Objeto</span>
              <span className="eval-summary-value" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {objetoEvaluado.nombre || objetoEvaluado}
              </span>
            </div>
          )}

          {objetoEvaluado?.categoria && (
            <div className="eval-summary-row">
              <span className="eval-summary-label">Categoría</span>
              <span className="eval-summary-value" style={{ color: 'var(--text-secondary)' }}>
                {objetoEvaluado.categoria}
              </span>
            </div>
          )}

          {protocoloInfo && (
            <div className="eval-summary-row">
              <span className="eval-summary-label">Protocolo</span>
              <span className="eval-summary-value" style={{ fontSize: 11, fontWeight: 600 }}>
                {protocoloInfo.nombre || protocoloInfo} {protocoloInfo.version ? `v${protocoloInfo.version}` : ''}
              </span>
            </div>
          )}

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
        </div>
      </div>

      {/* ── Tarjeta 2: Indicadores ── */}
      <EvaluationMetrics
        variables={variables}
        completadas={completadas}
        hallazgos={hallazgos}
        cobertura={cobertura}
      />

      {/* Nivel de Riesgo Global */}
      {riskLevel !== 'Sin riesgo' && (
        <div className="eval-side-card" style={{ background: rStyle.bg, borderLeft: `4px solid ${rStyle.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: rStyle.color }}>Nivel de Riesgo Global</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: rStyle.color }}>{riskLevel}</span>
          </div>
        </div>
      )}

      {/* ── Tarjeta 3: Alertas activas ── */}
      {alerts.length > 0 && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon" style={{ background: 'rgba(220,38,38,0.12)' }}>
              <AlertTriangle size={14} color="#dc2626" />
            </div>
            <span className="eval-side-title">Alertas generadas</span>
            <span className="eval-badge" style={{ marginLeft: 'auto', background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
              {alerts.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map((al, idx) => (
              <div key={idx} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.03)', borderLeft: '3px solid var(--accent-red)' }}>
                <span style={{ fontWeight: 700 }}>{al.nivelRiesgo || al.nivel_riesgo}:</span> {al.mensaje}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tarjeta 4: Evidencias ── */}
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

      {/* ── Tarjeta 5: Validaciones ── */}
      {validations.length > 0 && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon">✅</div>
            <span className="eval-side-title">Validaciones</span>
          </div>

          <ValidationChecklist items={validations} />
        </div>
      )}

      {/* ── CTA: Ir a revisión ── */}
      {onReview && <ReviewButton ready={ready} onClick={onReview} />}

    </div>
  );
};

export default EvaluationSummary;
