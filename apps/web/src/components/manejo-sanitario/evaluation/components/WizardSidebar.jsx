import React from 'react';
import { Leaf, BarChart3, Camera, CheckCircle, AlertTriangle, Shield, Tag, Microscope } from 'lucide-react';
import { EvaluationStateMachine } from '../domain/services/EvaluationStateMachine';

/**
 * WizardSidebar
 * =============
 * Panel lateral dinámico del wizard de evaluación.
 * Muestra en tiempo real: información del lote, objeto evaluado, protocolo,
 * indicadores calculados por los motores, alertas activas y estado de la evaluación.
 *
 * Todos los datos provienen de props — nunca estáticos.
 */
export default function WizardSidebar({
  selectedLote,
  selectedObjeto,
  fullProtocol,
  tipoMonitoreo,
  fecha,
  responsable,
  derivedMetrics,
  liveRuleResult,
  evaluationStatus,
  photos = [],
  step = 1,
  onNextStep,
  isLocked = false
}) {
  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const getInitials = (name) => {
    if (!name) return 'SD';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  /* ── Estado de la máquina ────────────────────────────────────────────── */
  const stateInfo = EvaluationStateMachine.getStateInfo(evaluationStatus || 'BORRADOR');

  /* ── Datos del protocolo ─────────────────────────────────────────────── */
  const protocolName    = fullProtocol?.nombre     || selectedObjeto?.protocolo?.nombre || '—';
  const protocolVersion = fullProtocol?.version    || selectedObjeto?.protocolo?.version || '—';
  const objetoNombre    = fullProtocol?.objetoEvaluacionNombre || selectedObjeto?.nombre_comun || selectedObjeto?.nombre || '—';
  const objetoCategoria = fullProtocol?.objetoCategoria        || selectedObjeto?.categoria || '—';
  const tipoLabel       = fullProtocol?.tipoMonitoreo          || tipoMonitoreo || 'Sanitario';

  /* ── Métricas vivas ──────────────────────────────────────────────────── */
  const coveragePct    = derivedMetrics?.coberturaPct    ?? 0;
  const incidenciaPct  = derivedMetrics?.incidenciaPct   ?? 0;
  const severidadPct   = derivedMetrics?.severidadPct    ?? 0;
  const riskLevel      = derivedMetrics?.riskLevel       ?? 'Sin riesgo';
  const alertCount     = derivedMetrics?.alertCount      ?? 0;
  const completedVars  = derivedMetrics?.completedVars   ?? 0;
  const pendingVars    = derivedMetrics?.pendingVars      ?? [];
  const totalVars      = (fullProtocol?.variables?.length) ?? 0;
  const coverageOk     = coveragePct >= 80;
  const areaEvaluada   = derivedMetrics?.areaEvaluada   ?? '0.0';

  /* ── Colores de riesgo ───────────────────────────────────────────────── */
  const riskColors = {
    'Sin riesgo': { color: '#15803d', bg: 'rgba(21,128,61,0.10)' },
    'Bajo':       { color: '#15803d', bg: 'rgba(21,128,61,0.10)' },
    'Medio':      { color: '#a16207', bg: 'rgba(234,179,8,0.10)' },
    'Alto':       { color: '#c2410c', bg: 'rgba(249,115,22,0.10)' },
    'Crítico':    { color: '#dc2626', bg: 'rgba(220,38,38,0.10)' }
  };
  const riskStyle = riskColors[riskLevel] || riskColors['Sin riesgo'];

  /* ── Alertas activas ─────────────────────────────────────────────────── */
  const activeAlerts = liveRuleResult?.alerts || derivedMetrics?.alerts || [];

  /* ── Guía del siguiente paso ─────────────────────────────────────────── */
  const nextStepHint = {
    1: 'Selecciona el tipo de evaluación que deseas realizar en este lote.',
    2: 'Diligencia los valores observados en las variables dinámicas del protocolo fitosanitario.',
    3: 'Revisa el consolidado del reporte de campo, valida los umbrales y guarda los cambios.',
    4: 'Firma la aprobación técnica e inicia la sincronización del reporte.'
  }[step] || '';

  return (
    <aside className="eval-side-col">

      {/* ══════════════════════════════════════════
          Badge de Estado de la Evaluación
      ══════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: stateInfo.bg || 'rgba(0,0,0,0.06)',
        marginBottom: 4
      }}>
        <span style={{ fontSize: 14 }}>{stateInfo.icon || '📋'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: stateInfo.color || 'var(--text-primary)' }}>
          Estado: {stateInfo.label || evaluationStatus}
        </span>
        {isLocked && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>🔒 Bloqueado</span>
        )}
      </div>

      {/* ══════════════════════════════════════════
          Card 1 · Protocolo e Información del Objeto
      ══════════════════════════════════════════ */}
      <div className="eval-side-card">
        <div className="eval-side-card-header">
          <div className="eval-side-icon eval-side-icon--green">
            <Leaf size={14} />
          </div>
          <span className="eval-side-title">Evaluación</span>
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
                  ? ` · ${selectedLote.cultivo_ref?.nombre_comun || selectedLote.cultivo}` : ''}
              </div>
            </div>
            <div className="eval-lote-thumb">🍃</div>
          </div>
        ) : (
          <div className="eval-info-empty">Ningún lote seleccionado</div>
        )}

        <div className="eval-info-rows">

          {/* Tipo de monitoreo */}
          <div className="eval-info-row">
            <span className="eval-info-label">Tipo monitoreo</span>
            <span className={`eval-badge ${tipoLabel.toLowerCase().includes('sanitario') ? 'green' : 'blue'}`}>
              {tipoLabel}
            </span>
          </div>

          {/* Objeto evaluado */}
          <div className="eval-info-row eval-info-row--border">
            <span className="eval-info-label">Objeto</span>
            <span className="eval-info-value eval-info-value--bold" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {objetoNombre}
            </span>
          </div>

          {/* Categoría del objeto */}
          <div className="eval-info-row eval-info-row--border">
            <span className="eval-info-label">Categoría</span>
            <span className="eval-info-value" style={{ color: 'var(--text-secondary)' }}>
              {objetoCategoria}
            </span>
          </div>

          {/* Protocolo y versión */}
          {protocolName !== '—' && (
            <div className="eval-info-row eval-info-row--border">
              <span className="eval-info-label">Protocolo</span>
              <span className="eval-info-value eval-info-value--bold" style={{ fontSize: 10, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {protocolName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>v{protocolVersion}</span>
              </span>
            </div>
          )}

          {/* Fecha */}
          <div className="eval-info-row eval-info-row--border">
            <span className="eval-info-label">Fecha</span>
            <span className="eval-info-value">{formatDate(fecha)}</span>
          </div>

          {/* Responsable */}
          <div className="eval-info-row--avatar eval-info-row--border">
            <div className="eval-avatar" aria-label={responsable}>
              {getInitials(responsable)}
            </div>
            <div>
              <div className="eval-info-value eval-info-value--bold">{responsable || '—'}</div>
              <div className="eval-info-value eval-info-value--muted" style={{ fontSize: 10 }}>Responsable</div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════
          Card 2 · Indicadores en Tiempo Real
      ══════════════════════════════════════════ */}
      {selectedLote && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon eval-side-icon--purple">
              <BarChart3 size={14} />
            </div>
            <span className="eval-side-title">Indicadores</span>
            {/* Badge de nivel de riesgo global */}
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 8,
              color: riskStyle.color, background: riskStyle.bg
            }}>
              {riskLevel}
            </span>
          </div>

          {/* Cobertura */}
          <div className="eval-progress-row">
            <div className="eval-progress-labels">
              <span className="eval-progress-lbl">Cobertura de muestreo</span>
              <span className="eval-progress-val">{areaEvaluada}&nbsp;ha&nbsp;({coveragePct}%)</span>
            </div>
            <div className="eval-progress-bar-track">
              <div
                className="eval-progress-bar-fill"
                style={{
                  width: `${Math.min(coveragePct, 100)}%`,
                  backgroundColor: coverageOk ? '#15803d' : '#c2410c',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Variables completas */}
          {totalVars > 0 && (
            <div className="eval-progress-row" style={{ marginTop: 8 }}>
              <div className="eval-progress-labels">
                <span className="eval-progress-lbl">Variables completadas</span>
                <span className="eval-progress-val">{completedVars} / {totalVars}</span>
              </div>
              <div className="eval-progress-bar-track">
                <div
                  className="eval-progress-bar-fill"
                  style={{
                    width: `${totalVars > 0 ? (completedVars / totalVars) * 100 : 0}%`,
                    backgroundColor: '#7c3aed',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>
          )}

          <div className="eval-indicators-list">
            <div className="eval-indicator-row">
              <span className="eval-info-label">Incidencia</span>
              <span className="eval-info-value eval-info-value--bold">{incidenciaPct}%</span>
            </div>
            <div className="eval-indicator-row eval-indicator-row--border">
              <span className="eval-info-label">Severidad</span>
              <span className="eval-info-value eval-info-value--bold" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: riskStyle.color, display: 'inline-block' }} />
                {severidadPct > 0 ? `${severidadPct}%` : '—'}
              </span>
            </div>
            {pendingVars.length > 0 && (
              <div className="eval-indicator-row eval-indicator-row--border">
                <span className="eval-info-label">Pendientes</span>
                <span className="eval-info-value" style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: 11 }}>
                  {pendingVars.filter(v => v.obligatorio).length} obligatoria(s)
                </span>
              </div>
            )}
          </div>

          {/* Alerta de cobertura */}
          <div className={`eval-coverage-alert ${coverageOk ? 'ok' : 'warn'}`}>
            {coverageOk
              ? '✅ Cobertura óptima alcanzada.'
              : `⚠ Cobertura insuficiente (${coveragePct}%). Evaluados: ${derivedMetrics?.puntosEvaluados || 0} / ${fullProtocol?.tamanioMuestra || 100}`
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          Card 3 · Alertas Activas (en tiempo real)
      ══════════════════════════════════════════ */}
      {step >= 3 && activeAlerts.length > 0 && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon" style={{ background: 'rgba(220,38,38,0.12)' }}>
              <AlertTriangle size={14} color="#dc2626" />
            </div>
            <span className="eval-side-title">Alertas activas</span>
            <span className="eval-badge" style={{ marginLeft: 'auto', background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
              {alertCount}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeAlerts.slice(0, 3).map((alert, idx) => {
              const alertColors = {
                'Bajo':    { color: '#15803d', bg: 'rgba(21,128,61,0.10)' },
                'Medio':   { color: '#a16207', bg: 'rgba(234,179,8,0.10)' },
                'Alto':    { color: '#c2410c', bg: 'rgba(249,115,22,0.10)' },
                'Crítico': { color: '#dc2626', bg: 'rgba(220,38,38,0.10)' }
              };
              const ac = alertColors[alert.nivel_riesgo] || alertColors['Medio'];
              return (
                <div key={idx} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: ac.bg, borderLeft: `3px solid ${ac.color}`
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ac.color, marginBottom: 2 }}>
                    {alert.nivel_riesgo} · {alert.variable_clave || ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {alert.mensaje}
                  </div>
                </div>
              );
            })}
            {activeAlerts.length > 3 && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                +{activeAlerts.length - 3} alerta(s) adicional(es)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          Card 4 · Evidencia fotográfica (paso ≥ 3)
      ══════════════════════════════════════════ */}
      {step >= 3 && (
        <div className="eval-side-card">
          <div className="eval-side-card-header">
            <div className="eval-side-icon eval-side-icon--blue">
              <Camera size={14} />
            </div>
            <span className="eval-side-title">Evidencia fotográfica</span>
            <span className="eval-badge gray" style={{ marginLeft: 'auto' }}>
              {photos.length} foto{photos.length !== 1 ? 's' : ''}
            </span>
          </div>

          {photos.length > 0 ? (
            <div className="eval-gallery-grid">
              {photos.slice(0, 3).map((src, i) => (
                <div key={i} className="eval-gallery-thumb">
                  <img src={src} alt={`Foto ${i + 1}`} />
                </div>
              ))}
              {photos.length > 3 && (
                <div className="eval-gallery-more">+{photos.length - 3}&nbsp;más</div>
              )}
            </div>
          ) : (
            <p className="eval-info-empty">Sin soporte fotográfico</p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          Card 5 · Siguiente paso
      ══════════════════════════════════════════ */}
      {!isLocked && (
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
      )}

      {isLocked && (
        <div className="eval-side-card" style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Evaluación en estado <strong>{stateInfo.label}</strong>.<br />
            Los datos son inmutables.
          </div>
        </div>
      )}

    </aside>
  );
}
