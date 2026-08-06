/**
 * PlanDetailObservationFormDrawer.jsx
 * Drawer para registrar o editar una observación de campo.
 * Soporta todos los tipos: note, symptom, foliar_analysis, application, soil, climate.
 */
import React, { useState, useCallback } from 'react';
import { X, PlusCircle } from 'lucide-react';

const OBS_TYPES = [
  { value:'note',            label:'📝 Nota general' },
  { value:'symptom',         label:'🔍 Síntoma Visual' },
  { value:'foliar_analysis', label:'🧪 Análisis Foliar' },
  { value:'application',     label:'💧 Aplicación' },
  { value:'soil',            label:'🌱 Suelo' },
  { value:'climate',         label:'🌦️ Clima' },
];

const SEVERITY_OPTIONS = [
  { value:'low',    label:'Baja' },
  { value:'medium', label:'Media' },
  { value:'high',   label:'Alta' },
];

const ELEMENT_DEFAULTS = [
  { elementCode:'N',  elementName:'Nitrógeno', unit:'%', targetMin:2.0, targetMax:3.0 },
  { elementCode:'P',  elementName:'Fósforo',   unit:'%', targetMin:0.15, targetMax:0.3 },
  { elementCode:'K',  elementName:'Potasio',   unit:'%', targetMin:2.0, targetMax:3.5 },
  { elementCode:'Ca', elementName:'Calcio',    unit:'%', targetMin:1.5, targetMax:2.5 },
  { elementCode:'Mg', elementName:'Magnesio',  unit:'%', targetMin:0.3, targetMax:0.6 },
];

const EMPTY_FORM = {
  type:           'note',
  title:          '',
  content:        '',
  isAlert:        false,
  severity:       '',
  affectedPercent:'',
  sector:         '',
  observedAt:     '',
  nutrients:      [],
};

export default function PlanDetailObservationFormDrawer({ isOpen, onClose, onSave, mutating }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [useNutrients, setUseNutrients] = useState(false);
  const [nutrientValues, setNutrientValues] = useState({});

  const reset = useCallback(() => {
    setForm(EMPTY_FORM);
    setUseNutrients(false);
    setNutrientValues({});
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return;

    const nutrients = useNutrients
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
      type:           form.type,
      title:          form.title || null,
      content:        form.content.trim(),
      isAlert:        form.isAlert,
      severity:       form.isAlert && form.severity ? form.severity : null,
      affectedPercent:form.isAlert && form.affectedPercent ? parseFloat(form.affectedPercent) : null,
      sector:         form.sector || null,
      observedAt:     form.observedAt ? new Date(form.observedAt).toISOString() : null,
      nutrients,
      attachments:    [],
    };

    try {
      await onSave(payload);
      handleClose();
    } catch {
      // toast ya mostrado por el hook
    }
  }, [form, useNutrients, nutrientValues, onSave, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="pd-drawer-overlay sc-drawer-overlay" role="dialog" aria-modal="true" aria-label="Nueva observación">
      <div className="pd-drawer sc-drawer-panel">
        {/* Encabezado */}
        <div className="pd-drawer__header">
          <h3 className="pd-drawer__title">
            <PlusCircle size={16} style={{ marginRight:6, verticalAlign:'middle' }} aria-hidden="true" />
            Nueva Observación
          </h3>
          <button
            className="pd-drawer__close"
            onClick={handleClose}
            aria-label="Cerrar drawer"
            id="obs-drawer-close-btn"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Formulario */}
        <form className="pd-drawer__body" onSubmit={handleSubmit} id="obs-form" noValidate>
          {/* Tipo */}
          <div className="pd-form-group">
            <label className="pd-form-label" htmlFor="obs-type">Tipo de observación</label>
            <select
              id="obs-type"
              className="pd-form-select"
              value={form.type}
              onChange={e => {
                handleChange('type', e.target.value);
                if (e.target.value === 'foliar_analysis') setUseNutrients(true);
              }}
            >
              {OBS_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div className="pd-form-group">
            <label className="pd-form-label" htmlFor="obs-title">
              Título <span style={{ color:'var(--pd-muted)', fontWeight:400 }}>(opcional)</span>
            </label>
            <input
              id="obs-title"
              className="pd-form-input"
              placeholder="Título de la observación"
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Contenido */}
          <div className="pd-form-group">
            <label className="pd-form-label" htmlFor="obs-content">
              Descripción <span style={{ color:'var(--pd-danger)', fontWeight:600 }}>*</span>
            </label>
            <textarea
              id="obs-content"
              className="pd-form-textarea"
              placeholder="Describe la observación con el mayor detalle posible…"
              value={form.content}
              onChange={e => handleChange('content', e.target.value)}
              required
              minLength={5}
              maxLength={5000}
              aria-required="true"
            />
          </div>

          {/* Fila: Sector + Fecha */}
          <div className="pd-form-row">
            <div className="pd-form-group">
              <label className="pd-form-label" htmlFor="obs-sector">Sector / Ubicación</label>
              <input
                id="obs-sector"
                className="pd-form-input"
                placeholder="Ej. Bloque A, Sector Norte"
                value={form.sector}
                onChange={e => handleChange('sector', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="pd-form-group">
              <label className="pd-form-label" htmlFor="obs-date">Fecha observada</label>
              <input
                id="obs-date"
                type="datetime-local"
                className="pd-form-input"
                value={form.observedAt}
                onChange={e => handleChange('observedAt', e.target.value)}
              />
            </div>
          </div>

          {/* Alerta toggle */}
          <div className="pd-form-group">
            <div className="pd-toggle-row">
              <div>
                <div className="pd-form-label">Marcar como alerta</div>
                <div className="pd-form-sublabel">Generará una alerta activa en el panel del plan</div>
              </div>
              <label className="pd-toggle" htmlFor="obs-alert">
                <input
                  id="obs-alert"
                  type="checkbox"
                  checked={form.isAlert}
                  onChange={e => handleChange('isAlert', e.target.checked)}
                />
                <div className="pd-toggle-slider" />
              </label>
            </div>

            {form.isAlert && (
              <div className="pd-form-row" style={{ marginTop:8 }}>
                <div className="pd-form-group">
                  <label className="pd-form-label" htmlFor="obs-severity">Severidad</label>
                  <select
                    id="obs-severity"
                    className="pd-form-select"
                    value={form.severity}
                    onChange={e => handleChange('severity', e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {SEVERITY_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pd-form-group">
                  <label className="pd-form-label" htmlFor="obs-affected">% afectado</label>
                  <input
                    id="obs-affected"
                    type="number"
                    className="pd-form-input"
                    placeholder="Ej. 15"
                    value={form.affectedPercent}
                    onChange={e => handleChange('affectedPercent', e.target.value)}
                    min={0} max={100} step={0.1}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Nutrientes (análisis foliar) */}
          {form.type === 'foliar_analysis' && (
            <div className="pd-form-group">
              <div className="pd-toggle-row">
                <div className="pd-form-label">Incluir datos nutricionales</div>
                <label className="pd-toggle" htmlFor="obs-nutrients-toggle">
                  <input
                    id="obs-nutrients-toggle"
                    type="checkbox"
                    checked={useNutrients}
                    onChange={e => setUseNutrients(e.target.checked)}
                  />
                  <div className="pd-toggle-slider" />
                </label>
              </div>

              {useNutrients && (
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                  {ELEMENT_DEFAULTS.map(el => (
                    <div key={el.elementCode} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:30, fontWeight:700, fontSize:13, color:'var(--pd-text)' }}>
                        {el.elementCode}
                      </span>
                      <span style={{ flex:1, fontSize:12, color:'var(--pd-secondary)' }}>{el.elementName}</span>
                      <input
                        type="number"
                        className="pd-form-input"
                        style={{ width:80 }}
                        placeholder={`${el.targetMin}–${el.targetMax}`}
                        value={nutrientValues[el.elementCode] ?? ''}
                        onChange={e => setNutrientValues(prev => ({ ...prev, [el.elementCode]: e.target.value }))}
                        min={0} step={0.01}
                        aria-label={`Valor de ${el.elementName} en ${el.unit}`}
                      />
                      <span style={{ fontSize:12, color:'var(--pd-muted)', width:20 }}>{el.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="pd-drawer__footer">
          <button
            type="button"
            className="pd-btn pd-btn--ghost"
            onClick={handleClose}
            disabled={mutating}
            id="obs-drawer-cancel-btn"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="obs-form"
            className="pd-btn pd-btn--primary"
            disabled={mutating || !form.content.trim()}
            id="obs-drawer-save-btn"
          >
            {mutating ? 'Guardando…' : 'Registrar observación'}
          </button>
        </div>
      </div>
    </div>
  );
}
