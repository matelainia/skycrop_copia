import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTraceability } from './hooks/useTraceability';
import { TraceabilityFilters } from './components/TraceabilityFilters';
import { TraceabilityTimeline } from './components/TraceabilityTimeline';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import IntegrityBadge from './components/IntegrityBadge';
import { traceabilityService } from './services/traceability.service';
import './traceability.css';

/**
 * TraceabilityModule — bitácora oficial del predio.
 * Layout según mockup: filtros arriba, timeline centro, detalle lateral.
 * Solo lectura: jamás edita el evento original.
 */
export function TraceabilityModule() {
  const {
    filters, setFilters, events, pagination, loading, error,
    selected, detail, detailLoading, selectEvent, loadMore,
    chain, summary
  } = useTraceability();
  const [lotes, setLotes] = useState([]);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    traceabilityService.listLotes().then(setLotes).catch(() => setLotes([]));
  }, []);

  const activeLote = lotes.find((l) => l.id === filters.lote_id);

  const handleExport = async () => {
    try {
      const q = { ...filters };
      delete q.page; delete q.limit;
      if (q.event_type === 'todas') delete q.event_type;
      await traceabilityService.downloadCsv(q);
    } catch (e) {
      alert(`No se pudo exportar: ${e.message}`);
    }
  };

  return (
    <div className="trz-page">
      <header className="trz-page-head">
        <div>
          <h2><span className="trz-head-icon">⛨</span> Trazabilidad</h2>
          <p>Consulta el historial de actividades realizadas en tu lote.</p>
        </div>
        {chain && (
          <div className="trz-chain">
            <IntegrityBadge status={(chain.compromised || 0) > 0 ? 'COMPROMETIDO' : 'VALIDADO'} />
            <span className="trz-muted">Integridad {chain.integrity_pct ?? 100}% · {chain.total || events.length} eventos</span>
            <button className="trz-btn-ghost" onClick={() => setShowAudit((s) => !s)}>
              {showAudit ? 'Ocultar auditoría' : 'Ver auditoría'}
            </button>
          </div>
        )}
      </header>

      <TraceabilityFilters filters={filters} onChange={setFilters} lotes={lotes} onExport={handleExport} />

      {error && (
        <div className="trz-alert">⚠ No se pudo cargar la bitácora: {error.message}</div>
      )}

      <div className="trz-layout">
        <div className="trz-main">
          <TraceabilityTimeline
            events={events}
            loading={loading}
            selectedId={selected?.id}
            onSelect={selectEvent}
            pagination={pagination}
            onLoadMore={loadMore}
          />
          {activeLote && (
            <aside className="trz-lote-card">
              <strong>Resumen del lote</strong>
              <dl>
                <div><dt>Lote</dt><dd>{activeLote.codigo_interno || activeLote.nombre}</dd></div>
                <div><dt>Cultivo</dt><dd>{activeLote.cultivo || '—'}</dd></div>
                <div><dt>Área</dt><dd>{activeLote.area_ha ? `${activeLote.area_ha} ha` : '—'}</dd></div>
                <div><dt>Variedad</dt><dd>{activeLote.variedad || '—'}</dd></div>
                {summary && <div><dt>Eventos</dt><dd>{summary.total_eventos} en 365 días</dd></div>}
              </dl>
            </aside>
          )}
        </div>

        <AnimatePresence>
          {selected && (
            <EventDetailDrawer event={detail || selected} loading={detailLoading} onClose={() => selectEvent(null)} />
          )}
        </AnimatePresence>
      </div>

      {showAudit && chain && (
        <section className="trz-card-soft trz-audit-strip">
          <h4>Auditoría de cadena — lote {activeLote?.codigo_interno || ''}</h4>
          <div className="trz-grid2">
            <div><span>Eventos verificados</span><strong>{chain.valid ?? 0} / {chain.total ?? 0}</strong></div>
            <div><span>Comprometidos</span><strong>{chain.compromised ?? 0}</strong></div>
            <div><span>Integridad</span><strong>{chain.integrity_pct ?? 100}%</strong></div>
            <div><span>Sistema</span><strong>SkyCrop Core · UPDATE=NO · DELETE=NO</strong></div>
          </div>
          {(chain.bad_events || []).length > 0 && (
            <p className="trz-alert">⚠ Eventos inválidos: {(chain.bad_events || []).map((b) => b.event_code || b.id).join(', ')}</p>
          )}
        </section>
      )}
    </div>
  );
}

export default TraceabilityModule;
