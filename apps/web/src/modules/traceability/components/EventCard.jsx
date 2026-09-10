import React from 'react';
import { eventMeta, formatEventDate, formatEventTime } from '../types/traceability.types';

/**
 * EventCard — tarjeta de la línea de tiempo (animación escalonada vía CSS).
 */
export function EventCard({ event, active, index = 0, onSelect }) {
  const meta = eventMeta(event.event_type);
  return (
    <button
      onClick={() => onSelect?.(event)}
      className={`trz-card ${active ? 'active' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="trz-card-date">
        <strong>{formatEventDate(event.event_date)}</strong>
        <span>{formatEventTime(event.event_date)}</span>
      </div>
      <div className="trz-card-icon" style={{ background: meta.bg }}>
        <span>{meta.icon}</span>
      </div>
      <div className="trz-card-body">
        <strong className="trz-card-title">{event.title || meta.label}</strong>
        <span className="trz-card-resp">Realizado por: {event.executor_name || event.created_by_name || event.responsable || '—'}</span>
        <span className="trz-chip" style={{ background: meta.bg, color: meta.color }}>{meta.short}</span>
      </div>
      <span className="trz-card-arrow">›</span>
    </button>
  );
}

export default EventCard;
