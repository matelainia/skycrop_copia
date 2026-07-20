import React from 'react';
import { Leaf, BarChart3, Camera, CheckCircle } from 'lucide-react';

export default function WizardSidebar({
  selectedLote,
  selectedObjeto,
  tipoMonitoreo,
  fecha,
  responsable,
  derivedMetrics,
  photos = [],
  step = 1,
  onNextStep
}) {
  /* ── helpers ── */
  const getInitials = (name) => {
    if (!name) return 'SD';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const tipoLabel = selectedObjeto?.categoria || tipoMonitoreo || 'Sanitario';
  const coveragePct = derivedMetrics?.coberturaPct ?? 0;
  const areaEvaluada = derivedMetrics?.areaEvaluada ?? '0.0';
  const incidenciaPct = derivedMetrics?.incidenciaPct ?? 0;
  const coverageMsg = derivedMetrics?.recs?.cobertura?.msg || 'Defina los puntos evaluados para ver la cobertura.';
  const coverageOk = (derivedMetrics?.recs?.cobertura?.status === 'success');

  const severidadLabel = incidenciaPct > 15 ? 'Alta' : incidenciaPct > 5 ? 'Media' : 'Baja';
  const severidadColor = incidenciaPct > 15 ? 'var(--accent-red)' : incidenciaPct > 5 ? 'var(--accent-gold)' : 'var(--primary)';

  const nextStepHint = {
    1: 'Selecciona el tipo de evaluación que deseas realizar en este lote.',
    2: 'Diligencia los valores observados en las variables dinámicas del protocolo fitosanitario.',
    3: 'Revisa el consolidado del reporte de campo, valida los umbrales y guarda los cambios.',
    4: 'Firma la aprobación técnica e inicia la sincronización del reporte.'
  }[step];

  return (
    <aside className="eval-side-col">

      {/* ══════════════════════════════════════════
          Card 1 · Información de la evaluación
      ══════════════════════════════════════════ */}
      <div className="eval-side-card">

        {/* Encabezado de la tarjeta */}
        <div className="eval-side-card-header">
          <div className="eval-side-icon eval-side-icon--green">
            <Leaf size={14} />
          </div>
          <span className="eval-side-title">Información de la evaluación</span>
        </div>

        {/* Lote / Sector */}
        {selectedLote ? (
          <div className="eval-lote-preview">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eval-info-sublabel">Lote / Sector</div>
              <div className="eval-info-value eval-info-value--bold">
                {selectedLote.codigo_interno
                  ? `Lote ${selectedLote.codigo_interno}${selectedLote.nombre ? ' · ' + selectedLote.nombre : ''}`
                  : selectedLote.nombre}
              </div>
              <div className="eval-info-value eval-info-value--muted" style={{ marginTop: 2 }}>
                {selectedLote.area_ha ? `${selectedLote.area_ha} ha` : '—'}
                {(selectedLote.cultivo_ref?.nombre_comun || selectedLote.cultivo)
                  ? ` · ${selectedLote.cultivo_ref?.nombre_comun || selectedLote.cultivo}`
                  : ''}
              </div>
            </div>
            {/* Thumbnail de cultivo */}
            <div className="eval-lote-thumb">
              🍃
            </div>
          </div>
        ) : (
          <div className="eval-info-empty">Ningún lote seleccionado</div>
        )}

        {/* Filas de info */}
        <div className="eval-info-rows">

          {/* Tipo de evaluación */}
          <div className="eval-info-row">
            <span className="eval-info-label">Tipo de evaluación</span>
            <span className={`eval-badge ${tipoLabel.toLowerCase().includes('fito') ? 'green' : 'blue'}`}>
              {tipoLabel}
            </span>
          </div>

          {/* Fecha y hora */}
          <div className="eval-info-row eval-info-row--border">
            <span className="eval-info-label">Fecha y hora</span>
            <span className="eval-info-value">
              {formatDate(fecha)} — 08:30 a.&nbsp;m.
            </span>
          </div>

          {/* Responsable */}
          <div className="eval-info-row--avatar eval-info-row--border">
            <div className="eval-avatar" aria-label={responsable || 'Sebastian Diaz'}>
              {getInitials(responsable)}
            </div>
            <div>
              <div className="eval-info-value eval-info-value--bold">
                {responsable || 'Sebastian Diaz'}
              </div>
              <div className="eval-info-value eval-info-value--muted" style={{ fontSize: '10px' }}>
                Ingeniero Agrónomo
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════
          Card 2 · Indicadores  (solo si hay lote)
      ══════════════════════════════════════════ */}
      {selectedLote && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon eval-side-icon--purple">
              <BarChart3 size={14} />
            </div>
            <span className="eval-side-title">Indicadores de evaluación</span>
          </div>

          {/* Área evaluada + barra */}
          <div className="eval-progress-row">
            <div className="eval-progress-labels">
              <span className="eval-progress-lbl">Área evaluada</span>
              <span className="eval-progress-val">{areaEvaluada}&nbsp;ha&nbsp;({coveragePct}%)</span>
            </div>
            <div className="eval-progress-bar-track">
              <div
                className="eval-progress-bar-fill"
                style={{ width: `${Math.min(coveragePct, 100)}%`, backgroundColor: '#7c3aed' }}
              />
            </div>
          </div>

          {/* Métricas secundarias */}
          <div className="eval-indicators-list">
            <div className="eval-indicator-row">
              <span className="eval-info-label">Intensidad de muestreo</span>
              <span className="eval-info-value eval-info-value--bold">16 puntos</span>
            </div>
            <div className="eval-indicator-row eval-indicator-row--border">
              <span className="eval-info-label">Variables con hallazgos</span>
              <span className="eval-info-value eval-info-value--bold" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-gold)', display: 'inline-block' }} />
                {incidenciaPct > 0 ? '2 de 4' : '0 de 4'}
              </span>
            </div>
            <div className="eval-indicator-row eval-indicator-row--border">
              <span className="eval-info-label">Severidad promedio</span>
              <span className="eval-info-value eval-info-value--bold" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: severidadColor, display: 'inline-block' }} />
                {severidadLabel}
              </span>
            </div>
          </div>

          {/* Alerta de cobertura */}
          <div className={`eval-coverage-alert ${coverageOk ? 'ok' : 'warn'}`}>
            {coverageMsg}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          Card 3 · Evidencia fotográfica (paso ≥ 3)
      ══════════════════════════════════════════ */}
      {step >= 3 && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon eval-side-icon--blue">
              <Camera size={14} />
            </div>
            <span className="eval-side-title">Evidencia fotográfica</span>
          </div>

          {photos.length > 0 ? (
            <div className="eval-gallery-grid">
              {photos.slice(0, 3).map((src, i) => (
                <div key={i} className="eval-gallery-thumb">
                  <img src={src} alt={`Foto ${i + 1}`} />
                </div>
              ))}
              {photos.length > 3 && (
                <div className="eval-gallery-more">
                  +{photos.length - 3}&nbsp;más
                </div>
              )}
            </div>
          ) : (
            <p className="eval-info-empty">Sin soporte fotográfico</p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          Card 4 · Siguiente paso
      ══════════════════════════════════════════ */}
      <div className="eval-side-card">
        <div className="eval-side-card-header">
          <div className="eval-side-icon eval-side-icon--green">
            <CheckCircle size={14} />
          </div>
          <span className="eval-side-title">Siguiente paso</span>
        </div>

        <p className="eval-next-hint">{nextStepHint}</p>

        <button
          type="button"
          className="eval-next-step-btn"
          onClick={onNextStep}
        >
          Ir al siguiente paso
        </button>
      </div>

    </aside>
  );
}
