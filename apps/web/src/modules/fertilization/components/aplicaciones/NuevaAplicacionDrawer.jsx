import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { X, Leaf, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../../../../context/AuthContext.jsx';
import { aplicacionesService } from '../../services/aplicaciones.service.js';

/**
 * NuevaAplicacionDrawer — Ventana emergente centrada para creación por usuario/empresa.
 * Comunicación Supabase per-user: lee planes reales (RLS) e inserta con company_id aislado.
 */
const NuevaAplicacionDrawer = memo(function NuevaAplicacionDrawer({ open, onClose, onCreated }) {
  const { user, empresa } = useAuthContext();
  const modalRef = useRef(null);

  const [planes, setPlanes] = useState([]);
  const [planesLoading, setPlanesLoading] = useState(true);
  const [form, setForm] = useState({
    plan_id: '',
    product_name: '',
    product_formula: '',
    scheduled_date: new Date().toISOString().slice(0, 10),
    dose_applied: '',
    dose_unit: 'kg/ha',
    status: 'pending',
    completion_note: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadPlanes() {
      setPlanesLoading(true);
      try {
        const data = await aplicacionesService.getPlanesForSelector();
        if (!cancelled) setPlanes(data);
      } catch {
        if (!cancelled) setPlanes([]);
      } finally {
        if (!cancelled) setPlanesLoading(false);
      }
    }
    loadPlanes();
    return () => { cancelled = true; };
  }, [open]);

  const validate = useCallback(() => {
    const e = {};
    if (!form.plan_id) e.plan_id = 'Selecciona un plan de fertilización.';
    if (!form.product_name.trim()) e.product_name = 'El fertilizante es requerido.';
    if (!form.scheduled_date) e.scheduled_date = 'La fecha es requerida.';
    if (form.dose_applied !== '' && isNaN(Number(form.dose_applied))) e.dose_applied = 'Dosis numérica inválida.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    if (!empresa?.id) {
      setSaveError('No se encontró la empresa del usuario. Selecciona una organización en Clerk.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        plan_id: form.plan_id,
        product_name: form.product_name.trim(),
        product_formula: form.product_formula.trim() || null,
        scheduled_date: form.scheduled_date,
        dose_applied: form.dose_applied === '' ? null : Number(form.dose_applied),
        dose_unit: form.dose_unit,
        status: form.status,
        completion_note: form.completion_note.trim() || null,
      };
      const context = {
        userId: user?.id || null,
        userName: user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() : null,
        companyId: empresa.id,
      };
      const created = await aplicacionesService.createAplicacion(payload, context);
      onCreated?.(created);
      onClose?.();
      setForm({
        plan_id: '',
        product_name: '',
        product_formula: '',
        scheduled_date: new Date().toISOString().slice(0, 10),
        dose_applied: '',
        dose_unit: 'kg/ha',
        status: 'pending',
        completion_note: '',
      });
    } catch (err) {
      setSaveError(err.message || 'No fue posible guardar la aplicación.');
    } finally {
      setSaving(false);
    }
  }, [form, validate, empresa, user, onCreated, onClose]);

  if (!open) return null;

  const hasPlanes = planes.length > 0;

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={modalRef}
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Nueva aplicación de fertilización"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="app-drawer__icon"><Leaf size={18} /></div>
            <div>
              <div className="app-drawer__title">Nueva Aplicación</div>
              <div className="app-drawer__subtitle">
                {empresa?.nombre ? `${empresa.nombre}` : 'Empresa no seleccionada'} · {user?.email || user?.id || 'Usuario'}
              </div>
            </div>
          </div>
          <button className="fert-btn fert-btn--ghost fert-btn--icon" onClick={onClose} aria-label="Cerrar formulario">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="app-modal__body">
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CheckCircle size={16} style={{ color: '#059669', flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Flujo SkyCrop: <strong>Recomendación</strong> → <strong>Aplicación</strong> → <strong>Registro real</strong>. Si existe una recomendación, el plan asociado ya contiene la dosis y nutrientes; aquí registras la ejecución.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="app-drawer__label" htmlFor="na-plan">Plan de fertilización *</label>
              {planesLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando planes reales...
                </div>
              ) : (
                <select
                  id="na-plan"
                  className="fert-dropdown"
                  value={form.plan_id}
                  onChange={(e) => setForm((p) => ({ ...p, plan_id: e.target.value }))}
                  style={{ width: '100%', marginTop: 6 }}
                  aria-invalid={!!errors.plan_id}
                >
                  <option value="">{hasPlanes ? 'Seleccionar plan...' : 'Sin planes disponibles'}</option>
                  {planes.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.label}</option>
                  ))}
                </select>
              )}
              {errors.plan_id && <span style={{ fontSize: 12, color: '#DC2626' }}>{errors.plan_id}</span>}
            </div>

            <div>
              <label className="app-drawer__label" htmlFor="na-product">Fertilizante aplicado *</label>
              <input
                id="na-product"
                type="text"
                placeholder="Ej: Urea 46% (dato real, no ejemplo)"
                value={form.product_name}
                onChange={(e) => setForm((p) => ({ ...p, product_name: e.target.value }))}
                className="plans-search__input"
                style={{ width: '100%', marginTop: 6 }}
                aria-invalid={!!errors.product_name}
              />
              {errors.product_name && <span style={{ fontSize: 12, color: '#DC2626' }}>{errors.product_name}</span>}
            </div>

            <div>
              <label className="app-drawer__label" htmlFor="na-formula">Fórmula (opcional)</label>
              <input
                id="na-formula"
                type="text"
                placeholder="Ej: 18-46-0"
                value={form.product_formula}
                onChange={(e) => setForm((p) => ({ ...p, product_formula: e.target.value }))}
                className="plans-search__input"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="app-drawer__label" htmlFor="na-date">Fecha *</label>
                <input
                  id="na-date"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                  className="plans-date-input"
                  style={{ width: '100%', marginTop: 6 }}
                  aria-invalid={!!errors.scheduled_date}
                />
                {errors.scheduled_date && <span style={{ fontSize: 12, color: '#DC2626' }}>{errors.scheduled_date}</span>}
              </div>
              <div>
                <label className="app-drawer__label" htmlFor="na-status">Estado</label>
                <select
                  id="na-status"
                  className="fert-dropdown"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  <option value="pending">Programada</option>
                  <option value="completed">Completada</option>
                  <option value="skipped">Omitida</option>
                  <option value="rescheduled">Reprogramada</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="app-drawer__label" htmlFor="na-dose">Dosis aplicada</label>
                <input
                  id="na-dose"
                  type="number"
                  step="0.01"
                  placeholder="0.0"
                  value={form.dose_applied}
                  onChange={(e) => setForm((p) => ({ ...p, dose_applied: e.target.value }))}
                  className="plans-search__input"
                  style={{ width: '100%', marginTop: 6 }}
                />
                {errors.dose_applied && <span style={{ fontSize: 12, color: '#DC2626' }}>{errors.dose_applied}</span>}
              </div>
              <div>
                <label className="app-drawer__label" htmlFor="na-unit">Unidad</label>
                <select
                  id="na-unit"
                  className="fert-dropdown"
                  value={form.dose_unit}
                  onChange={(e) => setForm((p) => ({ ...p, dose_unit: e.target.value }))}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  <option value="kg/ha">kg/ha</option>
                  <option value="kg">kg</option>
                  <option value="L/ha">L/ha</option>
                  <option value="g/planta">g/planta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="app-drawer__label" htmlFor="na-note">Observaciones</label>
              <textarea
                id="na-note"
                placeholder="Notas de campo (opcional)"
                value={form.completion_note}
                onChange={(e) => setForm((p) => ({ ...p, completion_note: e.target.value }))}
                rows={3}
                className="plans-search__input"
                style={{ width: '100%', marginTop: 6, resize: 'vertical', paddingTop: 10 }}
              />
            </div>

            {saveError && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#B91C1C', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={14} /> {saveError}
              </div>
            )}
          </div>
          </div>

          <div className="app-modal__footer">
            <button type="button" className="fert-btn fert-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="fert-btn fert-btn--primary" disabled={saving || planesLoading} style={{ minWidth: 140, justifyContent: 'center' }}>
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : 'Guardar aplicación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default NuevaAplicacionDrawer;
