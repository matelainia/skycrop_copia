/**
 * PlanDetailObservationCard.jsx
 * Tarjeta individual de observación de campo.
 * Muestra tipo, título, contenido, adjuntos, nutrientes y comentarios.
 */
import React, { useState } from 'react';
import { MessageSquare, Paperclip, Send } from 'lucide-react';

const TYPE_CONFIG = {
  note:            { label:'Nota',            cls:'',                        emoji:'📝' },
  symptom:         { label:'Síntoma Visual',  cls:'pd-obs-type-badge--symptom', emoji:'🔍' },
  foliar_analysis: { label:'Análisis Foliar', cls:'pd-obs-type-badge--foliar',  emoji:'🧪' },
  application:     { label:'Aplicación',      cls:'pd-obs-type-badge--application', emoji:'💧' },
  soil:            { label:'Suelo',           cls:'pd-obs-type-badge--soil',    emoji:'🌱' },
  climate:         { label:'Clima',           cls:'pd-obs-type-badge--climate', emoji:'🌦️' },
};

const SEV_LABEL = { low:'Baja', medium:'Media', high:'Alta' };

export default function PlanDetailObservationCard({ observation, onAddComment, mutating }) {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  const cfg = TYPE_CONFIG[observation.observation_type] || TYPE_CONFIG.note;

  const dateLabel = observation.observed_at
    ? new Date(observation.observed_at).toLocaleString('es-CO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
    : null;

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    try {
      await onAddComment(observation.id, commentText.trim());
      setCommentText('');
      setShowCommentInput(false);
    } catch {
      // El hook muestra el toast de error
    }
  };

  return (
    <article
      className={`pd-obs-card sc-card-hover sc-animate-fade-up ${observation.is_alert ? 'pd-obs-card--alert' : ''}`}
      aria-label={`Observación: ${observation.title || observation.observation_type}`}
    >
      {/* Header */}
      <div className="pd-obs-card__header">
        <span className={`pd-obs-type-badge ${cfg.cls}`} aria-label={`Tipo: ${cfg.label}`}>
          <span aria-hidden="true">{cfg.emoji}</span> {cfg.label}
        </span>
        <span className="pd-obs-card__meta">
          {observation.sector && <span>{observation.sector} ·</span>}
          {dateLabel}
        </span>
      </div>

      {/* Body */}
      <div className="pd-obs-card__body">
        {observation.title && <div className="pd-obs-card__title">{observation.title}</div>}
        <div className="pd-obs-card__content">{observation.content}</div>

        {/* Alerta tag */}
        {observation.is_alert && (
          <div style={{ marginTop:8, display:'flex', gap:6, alignItems:'center' }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999,
              fontSize:11, fontWeight:700, background:'var(--pd-warning-bg)', color:'var(--pd-warning)',
            }}>
              ⚠ Alerta · Severidad {SEV_LABEL[observation.severity] || '—'}
              {observation.affected_percent ? ` · ${observation.affected_percent}% afectado` : ''}
            </span>
          </div>
        )}

        {/* Nutrientes (resumen) */}
        {observation.nutrients?.length > 0 && (
          <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
            {observation.nutrients.map(n => (
              <span key={n.element_code} style={{
                padding:'2px 7px', borderRadius:999, fontSize:11,
                background: n.status === 'low' ? 'var(--pd-warning-bg)' : n.status === 'high' ? 'var(--pd-info-bg)' : 'var(--pd-success-bg)',
                color: n.status === 'low' ? 'var(--pd-warning)' : n.status === 'high' ? 'var(--pd-info)' : 'var(--pd-success)',
                fontWeight: 600,
              }}>
                {n.element_code}: {n.value}{n.unit || '%'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Adjuntos */}
      {observation.attachments?.length > 0 && (
        <div className="pd-obs-attachments" role="list" aria-label="Adjuntos">
          {observation.attachments.map(att => (
            <span key={att.id} className="pd-attachment-chip" role="listitem">
              <Paperclip size={11} aria-hidden="true" />
              {att.file_name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="pd-obs-card__footer">
        <span className="pd-obs-card__author" aria-label={`Registrado por ${observation.author_name || 'Sistema'}`}>
          {observation.author_name || 'Sistema'}
        </span>
        <button
          className="pd-btn pd-btn--ghost pd-btn--icon"
          style={{ fontSize:12, gap:4, padding:'4px 8px', display:'flex', alignItems:'center' }}
          onClick={() => setShowCommentInput(v => !v)}
          aria-expanded={showCommentInput}
          aria-label="Añadir comentario"
        >
          <MessageSquare size={13} aria-hidden="true" />
          {observation.comments?.length > 0 && (
            <span>{observation.comments.length}</span>
          )}
        </button>
      </footer>

      {/* Comentarios */}
      {(observation.comments?.length > 0 || showCommentInput) && (
        <div className="pd-obs-comments">
          {observation.comments?.map(c => (
            <div key={c.id} className="pd-comment-item">
              <span className="pd-comment-author">{c.author_name || 'Usuario'}</span>
              <span style={{ color:'var(--pd-muted)', fontSize:10, marginLeft:6 }}>
                {new Date(c.created_at).toLocaleString('es-CO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
              </span>
              <p style={{ marginTop:2 }}>{c.content}</p>
            </div>
          ))}

          {showCommentInput && (
            <div style={{ display:'flex', gap:6, marginTop:8 }}>
              <input
                className="pd-form-input"
                style={{ flex:1, padding:'6px 10px', fontSize:12 }}
                placeholder="Escribe un comentario…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                maxLength={2000}
                aria-label="Nuevo comentario"
              />
              <button
                className="pd-btn pd-btn--primary pd-btn--icon"
                onClick={handleSendComment}
                disabled={!commentText.trim() || mutating}
                aria-label="Enviar comentario"
              >
                <Send size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
