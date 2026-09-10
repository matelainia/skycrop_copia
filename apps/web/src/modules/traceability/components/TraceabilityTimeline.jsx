import React from 'react';
import { motion } from 'framer-motion';
import EventCard from './EventCard';

/**
 * TraceabilityTimeline — columna central de evidencia ordenada por fecha.
 */
export function TraceabilityTimeline({ events, loading, selectedId, onSelect, pagination, onLoadMore }) {
  if (loading && events.length === 0) {
    return (
      <div className="trz-timeline">
        <div className="trz-timeline-head"><strong>Línea de tiempo</strong></div>
        {[0, 1, 2, 3].map((i) => <div key={i} className="trz-skeleton" />)}
      </div>
    );
  }
  if (!loading && events.length === 0) {
    return (
      <div className="trz-timeline">
        <div className="trz-timeline-head"><strong>Línea de tiempo</strong></div>
        <div className="trz-empty">
          <span style={{ fontSize: 28 }}>📭</span>
          <strong>Sin evidencia para este lote</strong>
          <p>Selecciona un lote con actividades. La bitácora oficial muestra solo hechos verificados, nunca inventa registros.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="trz-timeline">
      <div className="trz-timeline-head">
        <strong>Línea de tiempo</strong>
        <span className="trz-count">{pagination?.total || events.length} actividades</span>
      </div>
      <div className="trz-rail">
        {events.map((ev, idx) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(idx, 8) * 0.06 }}
            className="trz-rail-item"
          >
            <span className="trz-dot" />
            <EventCard event={ev} index={idx} active={selectedId === ev.id} onSelect={onSelect} />
          </motion.div>
        ))}
      </div>
      <div className="trz-more">
        <span>Mostrando 1 - {events.length} de {pagination?.total || events.length} actividades</span>
        {(pagination?.page || 1) < (pagination?.totalPages || 1) && (
          <button className="trz-btn-ghost" onClick={onLoadMore} disabled={loading}>
            {loading ? 'Cargando…' : 'Cargar más ↓'}
          </button>
        )}
      </div>
    </div>
  );
}

export default TraceabilityTimeline;
