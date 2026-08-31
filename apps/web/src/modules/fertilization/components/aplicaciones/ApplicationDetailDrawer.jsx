import { memo, useEffect, useRef } from 'react';
import { X, Calendar, MapPinned, Sprout, FlaskConical, Droplets, FileText } from 'lucide-react';
import { ApplicationStatusBadge, PhenologyBadgeFert } from './AplicacionBadges.jsx';

const ApplicationDetailDrawer = memo(function ApplicationDetailDrawer({ aplicacion, open, onClose }) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // Focus trap simple: enfocar drawer
    drawerRef.current?.focus();
    // Bloquear scroll body
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !aplicacion) return null;

  return (
    <div className="app-drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={drawerRef}
        className="app-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de aplicación ${aplicacion.fechaFormatted}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-drawer__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="app-drawer__icon">
              <FlaskConical size={18} />
            </div>
            <div>
              <div className="app-drawer__title">Detalle de aplicación</div>
              <div className="app-drawer__subtitle">{aplicacion.fechaFormatted} · {aplicacion.loteSectorLabel}</div>
            </div>
          </div>
          <button className="fert-btn fert-btn--ghost fert-btn--icon" onClick={onClose} aria-label="Cerrar detalle">
            <X size={16} />
          </button>
        </div>

        <div className="app-drawer__body">
          <div className="app-drawer__section">
            <div className="app-drawer__label"><Calendar size={14} /> Fecha</div>
            <div className="app-drawer__value">{aplicacion.fechaFormatted}</div>
            {aplicacion.scheduledDate && aplicacion.completedDate && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Programada: {aplicacion.scheduledDate} · Completada: {aplicacion.completedDate}
              </div>
            )}
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label"><MapPinned size={14} /> Lote</div>
            <div className="app-drawer__value">{aplicacion.loteNombre}</div>
            {aplicacion.sectorNombre && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{aplicacion.sectorNombre}</div>}
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label"><Sprout size={14} /> Cultivo</div>
            <div className="app-drawer__value">{aplicacion.cultivo}</div>
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label">Fase fenológica</div>
            <div className="app-drawer__value"><PhenologyBadgeFert phase={aplicacion.faseFenologica} /></div>
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label"><FlaskConical size={14} /> Fertilizantes</div>
            {aplicacion.fertilizantes.length ? (
              <div className="app-drawer__card-list">
                {aplicacion.fertilizantes.map((f, i) => (
                  <div key={i} className="app-drawer__card">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{f}</span>
                    {aplicacion.doseApplied && i === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dosis: {aplicacion.doseApplied} {aplicacion.doseUnit || 'kg/ha'}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>
            )}
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label"><Droplets size={14} /> Nutrientes</div>
            {aplicacion.nutrientes && Object.keys(aplicacion.nutrientes).length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(aplicacion.nutrientes).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 13 }}>{k}: {Number(v).toFixed(1)} kg</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin nutrientes registrados</div>
            )}
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label">Método</div>
            <div className="app-drawer__value">{aplicacion.metodoLabel}</div>
          </div>

          <div className="app-drawer__section">
            <div className="app-drawer__label">Estado</div>
            <div className="app-drawer__value"><ApplicationStatusBadge status={aplicacion.estado} label={aplicacion.estadoLabel} /></div>
          </div>

          {(aplicacion.completionNote || aplicacion.raw?.observaciones) && (
            <div className="app-drawer__section">
              <div className="app-drawer__label"><FileText size={14} /> Observaciones</div>
              <div className="app-drawer__value" style={{ fontSize: 13, lineHeight: 1.5 }}>{aplicacion.completionNote || aplicacion.raw.observaciones}</div>
            </div>
          )}

          <div className="app-drawer__section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {aplicacion.id}</div>
            {aplicacion.planId && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plan: {aplicacion.planId}</div>}
          </div>
        </div>

        <div className="app-drawer__footer">
          <button className="fert-btn fert-btn--outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
});

export default ApplicationDetailDrawer;
