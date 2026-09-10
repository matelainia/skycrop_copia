import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import IntegrityBadge from './IntegrityBadge';
import MapPreview from './MapPreview';
import { eventMeta, formatEventDateTime } from '../types/traceability.types';
import { traceabilityService } from '../services/traceability.service';

/**
 * EventDetailDrawer — panel lateral de evidencia (tabs como el mockup).
 * Tabs: Detalles · Insumos · Personal · Ubicación · Archivos (+ Auditoría).
 * Solo lectura: nunca permite editar el evento original.
 */
const TABS = [
  { id: 'detalles', label: 'Detalles' },
  { id: 'insumos', label: 'Insumos utilizados' },
  { id: 'personal', label: 'Personal' },
  { id: 'ubicacion', label: 'Ubicación' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'auditoria', label: 'Auditoría' }
];

function metaToInsumos(metadata = {}) {
  // Normaliza insumos desde metadata heterogénea (fertilización, sanitario, cosecha).
  if (Array.isArray(metadata.insumos)) return metadata.insumos;
  if (Array.isArray(metadata.productos)) return metadata.productos;
  const rows = [];
  if (metadata.producto) rows.push({ insumo: metadata.producto, dosis: metadata.dosis ?? '—', unidad: metadata.unidad ?? '' });
  if (metadata.producto_comercial && metadata.producto_comercial !== metadata.producto) {
    rows.push({ insumo: metadata.producto_comercial, dosis: metadata.dosis ?? '—', unidad: metadata.unidad ?? '' });
  }
  for (const [k, v] of Object.entries(metadata)) {
    if (/urea|kcl|mgso|fertilizante|insumo/i.test(k) && typeof v !== 'object') {
      rows.push({ insumo: k, dosis: v, unidad: metadata.unidad || '' });
    }
  }
  return rows;
}

export function EventDetailDrawer({ event, loading, onClose }) {
  const [tab, setTab] = useState('detalles');
  const [audit, setAudit] = useState(null);
  const [verify, setVerify] = useState(null);

  useEffect(() => {
    setTab('detalles'); setAudit(null); setVerify(null);
    if (!event?.id || String(event.id).startsWith('src-')) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, v] = await Promise.all([
          traceabilityService.auditEvent(event.id).catch(() => null),
          traceabilityService.verifyEvent(event.id).catch(() => null)
        ]);
        if (!cancelled) { setAudit(a); setVerify(v); }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [event?.id]);

  if (!event) return null;
  const meta = eventMeta(event.event_type);
  const insumos = metaToInsumos(event.metadata || {});
  const md = event.metadata || {};

  return (
    <motion.aside
      className="trz-detail"
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <div className="trz-detail-head">
        <div className="trz-detail-title">
          <span className="trz-detail-icon" style={{ background: meta.bg }}>{meta.icon}</span>
          <div>
            <strong>{event.title || meta.label}</strong>
            <span>{formatEventDateTime(event.event_date)}</span>
            {event.event_code && <code className="trz-code">{event.event_code}</code>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IntegrityBadge status={event.integrity_status || (event._synthetic ? 'PENDIENTE_SYNC' : 'VALIDADO')} hash={event.event_hash} />
          <button className="trz-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
      </div>

      <nav className="trz-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <div className="trz-detail-body">
        {loading && <p className="trz-muted">Cargando evidencia verificada…</p>}

        {tab === 'detalles' && (
          <section className="trz-card-soft">
            <h4>Información general</h4>
            <div className="trz-grid2">
              <div><span>Tipo de actividad</span><strong>{meta.label}</strong></div>
              <div><span>Realizado por</span><strong>{event.executor_name || event.created_by_name || event.responsable || '—'}</strong></div>
              <div><span>Objetivo</span><p>{event.description || md.objetivo || '—'}</p></div>
              <div><span>Fecha y hora</span><strong>{formatEventDateTime(event.event_date)}</strong></div>
              <div><span>Método de aplicación</span><p>{md.metodo || md.metodo_aplicacion || '—'}</p></div>
              <div><span>Estado</span><IntegrityBadge compact status={event.integrity_status || 'PENDIENTE_SYNC'} /></div>
            </div>
            {(md.observaciones || md.notas) && (
              <div className="trz-notes">
                <h4>Notas adicionales</h4>
                <p>{md.observaciones || md.notas}</p>
              </div>
            )}
          </section>
        )}

        {tab === 'insumos' && (
          <section className="trz-card-soft">
            <h4>Insumos utilizados</h4>
            {insumos.length === 0 ? (
              <p className="trz-muted">Este evento no registra insumos (ej. monitoreo visual). El registro origen se muestra sin alteraciones.</p>
            ) : (
              <table className="trz-table">
                <thead><tr><th>Insumo</th><th>Dosis aplicada</th><th>Unidad</th></tr></thead>
                <tbody>
                  {insumos.map((r, i) => (
                    <tr key={i}><td>{r.insumo}</td><td>{r.dosis}</td><td>{r.unidad}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {md.cantidad != null && (
              <p className="trz-muted">Cantidad total: <strong>{md.cantidad} {md.unidad || ''}</strong></p>
            )}
          </section>
        )}

        {tab === 'personal' && (
          <section className="trz-card-soft">
            <h4>Personal</h4>
            <div className="trz-grid2">
              <div><span>Ejecutor</span><strong>{event.executor_name || '—'}</strong></div>
              <div><span>Registrado por</span><strong>{event.created_by_name || event.created_by || 'SkyCrop Core'}</strong></div>
              <div><span>Rol al momento</span><strong>{event.role_at_event || '—'}</strong></div>
              <div><span>Origen del dato</span><strong>{event.source_module || '—'}{event.source_code ? ` · ${event.source_code}` : ''}</strong></div>
            </div>
            <p className="trz-muted">La trazabilidad asocia un responsable por evento pero nunca reasigna el registro original.</p>
          </section>
        )}

        {tab === 'ubicacion' && (
          <section className="trz-card-soft">
            <h4>Ubicación</h4>
            <MapPreview latitud={event.latitud} longitud={event.longitud} ubicacionTexto={event.ubicacion_texto} />
            <button className="trz-btn-map" onClick={() => {
              if (event.latitud != null) window.open(`https://www.openstreetmap.org/?mlat=${event.latitud}&mlon=${event.longitud}#map=16/${event.latitud}/${event.longitud}`, '_blank');
            }}>Ver en mapa</button>
          </section>
        )}

        {tab === 'archivos' && (
          <section className="trz-card-soft">
            <h4>Evidencia</h4>
            <div className="trz-evid">
              <span>📷 Fotos ({(event.evidencia_urls || []).length})</span>
              <span>📄 Documentos ({(event.attachment_ids || []).length})</span>
              <span>📍 GPS {event.latitud != null ? 'registrado' : 'no registrado'}</span>
            </div>
            {(event.evidencia_urls || []).length === 0 ? (
              <p className="trz-muted">Sin archivos adjuntos. Las evidencias se almacenan en <code>traceability-evidence/{'{company}/{farm}/{lot}/{event}'}</code> con hash y timestamp.</p>
            ) : (
              <ul className="trz-files">
                {(event.evidencia_urls || []).map((u, i) => (
                  <li key={i}><a href={u} target="_blank" rel="noreferrer">📎 Evidencia {i + 1}</a></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'auditoria' && (
          <section className="trz-card-soft">
            <h4>Modo auditoría</h4>
            <div className="trz-grid2">
              <div><span>Evento creado</span><strong>{formatEventDateTime(event.created_at)}</strong></div>
              <div><span>Sistema</span><strong>SkyCrop Core</strong></div>
              <div><span>Hash</span><code className="trz-hash">{event.event_hash ? `${String(event.event_hash).slice(0, 12)}…` : 'pendiente (origen sin sellar)'}</code></div>
              <div><span>Estado</span><IntegrityBadge compact status={verify?.valid === false ? 'COMPROMETIDO' : (event.integrity_status || 'PENDIENTE_SYNC')} /></div>
            </div>
            {audit ? (
              <pre className="trz-pre">{JSON.stringify(audit, null, 2)}</pre>
            ) : (
              <p className="trz-muted">Verificación best-effort{verify ? `: ${verify.valid ? 'hash válido ✔' : 'hash inválido ⚠'}` : ' en curso…'} · UPDATE=NO · DELETE=NO.</p>
            )}
            {verify && verify.valid === false && (
              <p className="trz-alert">⚠ Integridad comprometida — evento inválido. Contactar administrador.</p>
            )}
          </section>
        )}
      </div>
    </motion.aside>
  );
}

export default EventDetailDrawer;
