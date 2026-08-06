/**
 * PlanDetailObservationInlineForm.jsx
 * Formulario inline para registrar observaciones de campo en el plan de fertilización.
 * Reemplaza la barra lateral (drawer) por un bloque integrado según diseño.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Save, Paperclip, ChevronDown, X } from 'lucide-react';

const OBS_TYPES = [
  { value: 'note',            label: 'Nota de campo' },
  { value: 'symptom',         label: 'Síntoma visual' },
  { value: 'foliar_analysis', label: 'Análisis foliar' },
  { value: 'application',     label: 'Aplicación' },
  { value: 'soil',            label: 'Suelo' },
  { value: 'climate',         label: 'Clima' },
];

const SEVERITY_OPTIONS = [
  { value: 'low',    label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high',   label: 'Alta' },
];

const ELEMENT_DEFAULTS = [
  { elementCode: 'N',  elementName: 'Nitrógeno', unit: '%', targetMin: 2.0, targetMax: 3.0 },
  { elementCode: 'P',  elementName: 'Fósforo',   unit: '%', targetMin: 0.15, targetMax: 0.3 },
  { elementCode: 'K',  elementName: 'Potasio',   unit: '%', targetMin: 2.0, targetMax: 3.5 },
  { elementCode: 'Ca', elementName: 'Calcio',    unit: '%', targetMin: 1.5, targetMax: 2.5 },
  { elementCode: 'Mg', elementName: 'Magnesio',  unit: '%', targetMin: 0.3, targetMax: 0.6 },
];

export default function PlanDetailObservationInlineForm({ onSave, mutating, userInitials = 'SD' }) {
  const [type, setType] = useState('note');
  const [content, setContent] = useState('');
  const [isAlert, setIsAlert] = useState(false);
  const [severity, setSeverity] = useState('');
  const [sector, setSector] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [useNutrients, setUseNutrients] = useState(false);
  const [nutrientValues, setNutrientValues] = useState({});

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const resetForm = useCallback(() => {
    setContent('');
    setType('note');
    setIsAlert(false);
    setSeverity('');
    setSector('');
    setObservedAt('');
    setAttachments([]);
    setUseNutrients(false);
    setNutrientValues({});
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        name: file.name,
        size: file.size,
        file
      }));
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || mutating) return;

    const nutrients = (type === 'foliar_analysis' && useNutrients)
      ? ELEMENT_DEFAULTS
          .filter(el => nutrientValues[el.elementCode] !== undefined && nutrientValues[el.elementCode] !== '')
          .map(el => ({
            elementCode: el.elementCode,
            elementName: el.elementName,
            unit:        el.unit,
            value:       parseFloat(nutrientValues[el.elementCode]),
            targetMin:   el.targetMin,
            targetMax:   el.targetMax,
            status:      (() => {
              const v = parseFloat(nutrientValues[el.elementCode]);
              if (v < el.targetMin) return 'low';
              if (v > el.targetMax) return 'high';
              return 'optimal';
            })(),
          }))
      : [];

    const payload = {
      type,
      title: null,
      content: content.trim(),
      isAlert,
      severity: isAlert && severity ? severity : null,
      affectedPercent: null,
      sector: sector.trim() || null,
      observedAt: observedAt ? new Date(observedAt).toISOString() : null,
      nutrients,
      attachments: attachments.map(a => a.name),
    };

    try {
      await onSave(payload);
      resetForm();
    } catch {
      // toast manejado por el hook consumidor
    }
  };

  return (
    <div className="pd-inline-obs-card" id="inline-observation-form">
      {/* Header */}
      <div className="pd-inline-obs-header">
        <div className="pd-inline-obs-avatar">{userInitials}</div>
        <div className="pd-inline-obs-title-group">
          <span className="pd-inline-obs-title">Registrar nueva observación</span>
          <span className="pd-inline-obs-subtitle">· quedará en el historial del plan</span>
        </div>
      </div>

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="pd-inline-obs-textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="pd-inline-obs-textarea"
            placeholder="Describe la observación de campo: síntomas, mediciones, recomendaciones..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            id="obs-content-input"
          />
        </div>

        {/* Archivos adjuntos */}
        {attachments.length > 0 && (
          <div className="pd-inline-obs-attachments">
            {attachments.map((att, idx) => (
              <span key={idx} className="pd-inline-obs-attachment-chip">
                <Paperclip size={12} />
                <span className="pd-inline-obs-attachment-name">{att.name}</span>
                <button
                  type="button"
                  className="pd-inline-obs-attachment-remove"
                  onClick={() => handleRemoveAttachment(idx)}
                  aria-label="Eliminar adjunto"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Barra de Acciones / Controles */}
        <div className="pd-inline-obs-actions-row">
          <div className="pd-inline-obs-actions-left">
            {/* Select Tipo de Observación */}
            <div className="pd-inline-obs-select-wrapper">
              <select
                className="pd-inline-obs-select"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  if (e.target.value === 'foliar_analysis') setUseNutrients(true);
                }}
                id="obs-type-select"
              >
                {OBS_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pd-inline-obs-select-arrow" />
            </div>

            {/* Toggle Marcar como alerta */}
            <label className="pd-inline-obs-toggle-label" htmlFor="obs-alert-checkbox">
              <input
                type="checkbox"
                id="obs-alert-checkbox"
                className="pd-inline-obs-toggle-checkbox"
                checked={isAlert}
                onChange={(e) => setIsAlert(e.target.checked)}
              />
              <span className="pd-inline-obs-toggle-slider" />
              <span className="pd-inline-obs-toggle-text">Marcar como alerta</span>
            </label>

            {/* Botón Adjuntar */}
            <button
              type="button"
              className="pd-inline-obs-btn-attach"
              onClick={() => fileInputRef.current?.click()}
              id="obs-attach-btn"
            >
              <Paperclip size={16} />
              <span>Adjuntar</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              multiple
            />
          </div>

          <div className="pd-inline-obs-actions-right">
            {/* Botón Guardar Observación */}
            <button
              type="submit"
              className="pd-inline-obs-btn-submit"
              disabled={mutating || !content.trim()}
              id="obs-save-btn"
            >
              <Save size={16} />
              <span>{mutating ? 'Guardando…' : 'Guardar Observación'}</span>
            </button>
          </div>
        </div>

        {/* Campos adicionales condicionales (Alerta / Análisis Foliar) */}
        {(isAlert || type === 'foliar_analysis') && (
          <div className="pd-inline-obs-extra-fields">
            {isAlert && (
              <div className="pd-form-row" style={{ marginTop: 10 }}>
                <div className="pd-form-group">
                  <label className="pd-form-label" htmlFor="obs-inline-severity">Severidad de alerta</label>
                  <select
                    id="obs-inline-severity"
                    className="pd-form-select"
                    value={severity}
                    onChange={e => setSeverity(e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {SEVERITY_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {type === 'foliar_analysis' && (
              <div className="pd-form-group" style={{ marginTop: 10 }}>
                <div className="pd-toggle-row">
                  <span className="pd-form-label">Incluir valores nutricionales</span>
                  <label className="pd-toggle" htmlFor="obs-inline-nutrients-toggle">
                    <input
                      id="obs-inline-nutrients-toggle"
                      type="checkbox"
                      checked={useNutrients}
                      onChange={e => setUseNutrients(e.target.checked)}
                    />
                    <div className="pd-toggle-slider" />
                  </label>
                </div>
                {useNutrients && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginTop: 8 }}>
                    {ELEMENT_DEFAULTS.map(el => (
                      <div key={el.elementCode} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 12, width: 22, color: 'var(--pd-text)' }}>{el.elementCode}:</span>
                        <input
                          type="number"
                          className="pd-form-input"
                          style={{ padding: '4px 6px', fontSize: 12, height: 28 }}
                          placeholder={`${el.targetMin}-${el.targetMax}`}
                          value={nutrientValues[el.elementCode] ?? ''}
                          onChange={e => setNutrientValues(prev => ({ ...prev, [el.elementCode]: e.target.value }))}
                          min={0} step={0.01}
                        />
                        <span style={{ fontSize: 11, color: 'var(--pd-muted)' }}>{el.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
