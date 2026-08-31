import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { X, FlaskConical, MapPin, FileText, TestTubes, Building2, Save, Loader2 } from 'lucide-react';
import SoilUploader from './SoilUploader.jsx';
import SoilLocationPicker from './SoilLocationPicker.jsx';
import SoilResultsForm from './SoilResultsForm.jsx';
import { soilAnalysisService } from '../../services/soilAnalysis.service.js';
import { soilAnalysisStorageService } from '../../services/soilAnalysisStorage.service.js';
import { useAuthContext } from '../../../../context/AuthContext.jsx';

const SoilFormDrawer = memo(function SoilFormDrawer({
  open,
  onClose,
  onCreated,
  onUpdated,
  editing = null, // ViewModel si es edición
  predios = [],
  lotes = [],
  laboratorios = [],
  parametros = [],
  prediosLoading = false,
  lotesLoading = false,
  labsLoading = false,
}) {
  const { empresa, user } = useAuthContext();
  const companyId = empresa?.id;

  const isEditing = Boolean(editing);
  const initialState = useMemo(() => ({
    predio_id: editing?.predioId || '',
    lote_id: editing?.loteId || '',
    nombre_muestra: editing?.nombreMuestra || '',
    codigo_muestra: editing?.codigoMuestra || '',
    laboratorio_id: editing?.laboratorioId || '',
    fecha_muestreo: editing?.fechaMuestreo || '',
    fecha_recepcion: editing?.fechaRecepcion || '',
    fecha_analisis: editing?.fechaAnalisis || new Date().toISOString().slice(0,10),
    muestreador: editing?.muestreador || '',
    metodo_muestreo: editing?.metodoMuestreo || '',
    profundidad_min_cm: editing?.profundidadMin ?? '',
    profundidad_max_cm: editing?.profundidadMax ?? '',
    observaciones: editing?.observaciones || '',
    latitude: editing?.latitude ?? '',
    longitude: editing?.longitude ?? '',
    accuracy_m: editing?.accuracyM ?? '',
    altitude: editing?.altitude ?? '',
    captured_at: editing?.capturedAt || null,
    ubicacion_nombre: editing?.ubicacionNombre || '',
    ubicacion_descripcion: editing?.ubicacionDescripcion || '',
    estado: editing?.estado || 'borrador',
  }), [editing]);

  const [form, setForm] = useState(initialState);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [newLabOpen, setNewLabOpen] = useState(false);
  const [newLabName, setNewLabName] = useState('');
  const [newLabNit, setNewLabNit] = useState('');
  const [creatingLab, setCreatingLab] = useState(false);

  // Ventana flotante: ocultar barra lateral y bloquear scroll del fondo
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.classList.add('soil-form-modal-open');
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('soil-form-modal-open');
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setForm(initialState);
      setErrors({});
      setSaveError(null);
      setFile(null);
      setFileError(null);
      setUploadProgress(null);
      setResults([]);
      setResultsLoading(false);
      if (isEditing && editing?.id) {
        let cancelled = false;
        async function loadResults() {
          setResultsLoading(true);
          try {
            const data = await soilAnalysisService.getResultados(editing.id);
            if (!cancelled) {
              setResults((data || []).map((r) => ({
                codigo_parametro: r.codigo_parametro,
                parametro: r.parametro,
                valor: r.valor != null ? String(r.valor) : '',
                unidad: r.unidad,
                metodo_analitico: r.metodo_analitico,
                nivel_interpretacion: r.nivel_interpretacion,
                observacion: r.observacion,
                orden: r.orden,
              })));
            }
          } catch {
            if (!cancelled) setResults([]);
          } finally {
            if (!cancelled) setResultsLoading(false);
          }
        }
        loadResults();
        return () => { cancelled = true; };
      }
    }
  }, [open, initialState, isEditing, editing?.id]);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  const handleLocationChange = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleRemoveLocation = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      latitude: '',
      longitude: '',
      accuracy_m: '',
      altitude: '',
      captured_at: null,
      ubicacion_nombre: '',
      ubicacion_descripcion: '',
    }));
  }, []);

  const validate = useCallback(() => {
    const e = {};
    // Obligatorios: Predio, Fecha de análisis, Laboratorio (según validaciones 34)
    if (!form.predio_id && !form.lote_id) {
      // Permitir que al menos uno de predio o lote sea requerido si se quiere flexibilidad,
      // pero spec dice Predio obligatorio. Si predio no seleccionado pero lote sí, derivar.
      // Por ahora exigir predio si no hay lote
      if (!form.lote_id) e.predio_id = 'Selecciona un predio.';
    }
    if (!form.fecha_analisis) e.fecha_analisis = 'Fecha de análisis requerida.';
    if (!form.laboratorio_id) e.laboratorio_id = 'Selecciona un laboratorio.';

    // Si lat proporcionado sin lon o viceversa, error
    const hasLat = form.latitude !== '' && form.latitude != null;
    const hasLon = form.longitude !== '' && form.longitude != null;
    if (hasLat !== hasLon) {
      if (!hasLat) e.latitude = 'Latitud requerida si hay longitud.';
      if (!hasLon) e.longitude = 'Longitud requerida si hay latitud.';
    }
    // Validar rangos
    if (hasLat && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) e.latitude = 'Latitud entre -90 y 90.';
    if (hasLon && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) e.longitude = 'Longitud entre -180 y 180.';

    return e;
  }, [form]);

  const handleSave = useCallback(async (targetEstado = null) => {
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    if (!companyId) {
      setSaveError('Empresa no identificada. Recarga la sesión.');
      return;
    }
    setSaving(true);
    setSaveError(null);

    try {
      // Preparar payload
      const payload = {
        predio_id: form.predio_id || null,
        lote_id: form.lote_id || null,
        nombre_muestra: form.nombre_muestra || null,
        codigo_muestra: form.codigo_muestra || null,
        laboratorio_id: form.laboratorio_id || null,
        fecha_muestreo: form.fecha_muestreo || null,
        fecha_recepcion: form.fecha_recepcion || null,
        fecha_analisis: form.fecha_analisis,
        muestreador: form.muestreador || null,
        metodo_muestreo: form.metodo_muestreo || null,
        profundidad_min_cm: form.profundidad_min_cm !== '' ? form.profundidad_min_cm : null,
        profundidad_max_cm: form.profundidad_max_cm !== '' ? form.profundidad_max_cm : null,
        observaciones: form.observaciones || null,
        latitude: form.latitude !== '' ? form.latitude : null,
        longitude: form.longitude !== '' ? form.longitude : null,
        accuracy_m: form.accuracy_m !== '' ? form.accuracy_m : null,
        altitude: form.altitude !== '' ? form.altitude : null,
        captured_at: form.captured_at || null,
        ubicacion_nombre: form.ubicacion_nombre || null,
        ubicacion_descripcion: form.ubicacion_descripcion || null,
        estado: targetEstado || form.estado || 'borrador',
      };

      let saved;
      if (isEditing) {
        saved = await soilAnalysisService.updateAnalisis(editing.id, payload, { userId: user?.id, companyId });
      } else {
        saved = await soilAnalysisService.createAnalisis(payload, { userId: user?.id, companyId });
      }

      const analysisId = saved.id;

      // Subir PDF si hay archivo seleccionado
      if (file) {
        setUploadProgress(10);
        try {
          const up = await soilAnalysisStorageService.uploadPdf(
            file,
            { companyId, predioId: form.predio_id || 'sin-predio', analysisId },
            (p) => setUploadProgress(p)
          );
          // Actualizar registro con path
          await soilAnalysisService.updateAnalisis(analysisId, {
            archivo_pdf_path: up.path,
            archivo_pdf_nombre: up.fileName,
            archivo_pdf_size: up.size,
            archivo_pdf_mime: up.mime,
          }, { userId: user?.id, companyId });
          setUploadProgress(100);
        } catch (upErr) {
          setFileError(upErr.message);
          // No fallar transacción: análisis ya creado, informar
        }
      }

      // Guardar resultados si hay
      if (results.length > 0) {
        const cleanResults = results
          .filter((r) => r.codigo_parametro && r.valor !== '' && r.valor != null)
          .map((r, idx) => ({
            codigo_parametro: r.codigo_parametro,
            parametro: r.parametro,
            valor: r.valor,
            unidad: r.unidad || '-',
            metodo_analitico: r.metodo_analitico || null,
            nivel_interpretacion: r.nivel_interpretacion || null,
            observacion: r.observacion || null,
            orden: idx,
          }));
        if (cleanResults.length) {
          await soilAnalysisService.saveResultados(analysisId, cleanResults, { companyId });
        }
      }

      // Opcional: si estado era borrador y ahora completo, se actualizará
      if (isEditing) onUpdated?.(saved);
      else onCreated?.(saved);
      onClose?.();
    } catch (e) {
      setSaveError(e.message || 'No fue posible guardar el análisis.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }, [validate, companyId, form, isEditing, editing?.id, user?.id, file, results, onCreated, onUpdated, onClose]);

  const handleCreateLab = useCallback(async () => {
    if (!newLabName.trim()) return;
    setCreatingLab(true);
    try {
      const lab = await soilAnalysisService.createLaboratorio({ nombre: newLabName.trim(), nit: newLabNit.trim() || null }, { companyId, userId: user?.id });
      setForm((prev) => ({ ...prev, laboratorio_id: String(lab.id) }));
      setNewLabOpen(false);
      setNewLabName('');
      setNewLabNit('');
    } catch (e) {
      alert(e.message);
    } finally {
      setCreatingLab(false);
    }
  }, [newLabName, newLabNit, companyId, user?.id]);

  if (!open) return null;

  return (
    <div className="soil-form-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={isEditing ? 'Editar análisis de suelo' : 'Nuevo análisis de suelo'}>
      <div className="soil-form" onClick={(e) => e.stopPropagation()}>
        <div className="soil-form__header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6B7280' }}>
              <FlaskConical size={14} style={{ color: '#059669' }} /> Análisis de Suelos
            </div>
            <div className="soil-form__title" style={{ marginTop: 4 }}>{isEditing ? 'Editar análisis' : 'Nuevo análisis de suelo'}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Estado: <span className={`soil-badge soil-badge--${form.estado === 'completo' ? 'completed' : 'draft'}`} style={{ fontSize: 10 }}>{form.estado === 'completo' ? 'Completado' : 'Borrador'}</span></div>
          </div>
          <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={onClose} aria-label="Cerrar formulario">
            <X size={18} />
          </button>
        </div>

        <div className="soil-form__body">
          {/* Paso 1 — Información */}
          <section className="soil-form__section">
            <div className="soil-form__section-title"><FileText size={14} /> Información general</div>

            <div className="soil-form__grid-2">
              <div className="soil-form__field">
                <label className="soil-form__label soil-form__label--required">Predio</label>
                <select
                  value={form.predio_id}
                  onChange={(e) => setField('predio_id', e.target.value)}
                  className={`soil-form__select ${errors.predio_id ? 'soil-form__select--error' : ''}`}
                  disabled={prediosLoading}
                >
                  <option value="">Seleccionar predio</option>
                  {predios.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                {errors.predio_id && <div className="soil-form__error">{errors.predio_id}</div>}
              </div>

              <div className="soil-form__field">
                <label className="soil-form__label">Lote / Sector</label>
                <select
                  value={form.lote_id}
                  onChange={(e) => setField('lote_id', e.target.value)}
                  className="soil-form__select"
                  disabled={lotesLoading}
                >
                  <option value="">Seleccionar lote</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="soil-form__grid-2">
              <div className="soil-form__field">
                <label className="soil-form__label">Nombre de muestra</label>
                <input
                  type="text"
                  value={form.nombre_muestra}
                  onChange={(e) => setField('nombre_muestra', e.target.value)}
                  placeholder="Muestra Bloque Norte"
                  className="soil-form__input"
                />
              </div>
              <div className="soil-form__field">
                <label className="soil-form__label">Código de muestra</label>
                <input
                  type="text"
                  value={form.codigo_muestra}
                  onChange={(e) => setField('codigo_muestra', e.target.value)}
                  placeholder="MS-2025-001"
                  className="soil-form__input"
                />
              </div>
            </div>
          </section>

          {/* Paso 2 — Laboratorio */}
          <section className="soil-form__section">
            <div className="soil-form__section-title"><Building2 size={14} /> Laboratorio</div>

            <div className="soil-form__field">
              <label className="soil-form__label soil-form__label--required">Laboratorio</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={form.laboratorio_id}
                  onChange={(e) => setField('laboratorio_id', e.target.value)}
                  className={`soil-form__select ${errors.laboratorio_id ? 'soil-form__select--error' : ''}`}
                  disabled={labsLoading}
                  style={{ flex: 1 }}
                >
                  <option value="">Seleccionar laboratorio</option>
                  {laboratorios.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="fert-btn fert-btn--outline"
                  onClick={() => setNewLabOpen((v) => !v)}
                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  + Nuevo lab
                </button>
              </div>
              {errors.laboratorio_id && <div className="soil-form__error">{errors.laboratorio_id}</div>}
              {newLabOpen && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, padding: 12, borderRadius: 12, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <input type="text" placeholder="Nombre lab" value={newLabName} onChange={(e) => setNewLabName(e.target.value)} className="soil-form__input" style={{ flex: 1 }} />
                  <input type="text" placeholder="NIT" value={newLabNit} onChange={(e) => setNewLabNit(e.target.value)} className="soil-form__input" style={{ width: 140 }} />
                  <button type="button" className="fert-btn fert-btn--primary" onClick={handleCreateLab} disabled={creatingLab} style={{ fontSize: 12 }}>
                    {creatingLab ? <Loader2 size={14} className="animate-spin" /> : 'Crear'}
                  </button>
                </div>
              )}
            </div>

            <div className="soil-form__grid-3">
              <div className="soil-form__field">
                <label className="soil-form__label">Fecha de muestreo</label>
                <input type="date" value={form.fecha_muestreo} onChange={(e) => setField('fecha_muestreo', e.target.value)} className="soil-form__input" />
              </div>
              <div className="soil-form__field">
                <label className="soil-form__label">Fecha de recepción</label>
                <input type="date" value={form.fecha_recepcion} onChange={(e) => setField('fecha_recepcion', e.target.value)} className="soil-form__input" />
              </div>
              <div className="soil-form__field">
                <label className="soil-form__label soil-form__label--required">Fecha del análisis</label>
                <input type="date" value={form.fecha_analisis} onChange={(e) => setField('fecha_analisis', e.target.value)} className={`soil-form__input ${errors.fecha_analisis ? 'soil-form__input--error' : ''}`} />
                {errors.fecha_analisis && <div className="soil-form__error">{errors.fecha_analisis}</div>}
              </div>
            </div>
          </section>

          {/* Paso 3 — Muestreo */}
          <section className="soil-form__section">
            <div className="soil-form__section-title"><TestTubes size={14} /> Muestreo</div>

            <div className="soil-form__grid-2">
              <div className="soil-form__field">
                <label className="soil-form__label">Método de muestreo</label>
                <select value={form.metodo_muestreo} onChange={(e) => setField('metodo_muestreo', e.target.value)} className="soil-form__select">
                  <option value="">Seleccionar</option>
                  <option value="zigzag">Zigzag</option>
                  <option value="aleatorio">Aleatorio</option>
                  <option value="sistematico">Sistemático</option>
                  <option value="estratificado">Estratificado</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="soil-form__field">
                <label className="soil-form__label">Muestreado por</label>
                <input type="text" value={form.muestreador} onChange={(e) => setField('muestreador', e.target.value)} placeholder="Juan Pérez" className="soil-form__input" />
              </div>
            </div>

            <div className="soil-form__grid-2">
              <div className="soil-form__field">
                <label className="soil-form__label">Profundidad mínima (cm)</label>
                <input type="number" value={form.profundidad_min_cm} onChange={(e) => setField('profundidad_min_cm', e.target.value)} placeholder="0" className="soil-form__input" />
              </div>
              <div className="soil-form__field">
                <label className="soil-form__label">Profundidad máxima (cm)</label>
                <input type="number" value={form.profundidad_max_cm} onChange={(e) => setField('profundidad_max_cm', e.target.value)} placeholder="20" className="soil-form__input" />
              </div>
            </div>

            <div className="soil-form__field">
              <label className="soil-form__label">Observaciones</label>
              <textarea
                value={form.observaciones}
                onChange={(e) => setField('observaciones', e.target.value)}
                placeholder="Notas del muestreo..."
                rows={3}
                className="soil-form__textarea"
              />
            </div>
          </section>

          {/* Paso 4 — Ubicación */}
          <section className="soil-form__section">
            <div className="soil-form__section-title"><MapPin size={14} /> Ubicación del muestreo</div>
            <SoilLocationPicker
              latitude={form.latitude !== '' ? Number(form.latitude) : null}
              longitude={form.longitude !== '' ? Number(form.longitude) : null}
              accuracyM={form.accuracy_m !== '' ? Number(form.accuracy_m) : null}
              altitude={form.altitude !== '' ? Number(form.altitude) : null}
              capturedAt={form.captured_at}
              ubicacionNombre={form.ubicacion_nombre}
              ubicacionDescripcion={form.ubicacion_descripcion}
              onChange={handleLocationChange}
              onRemove={handleRemoveLocation}
            />
            {errors.latitude && <div className="soil-form__error">{errors.latitude}</div>}
            {errors.longitude && <div className="soil-form__error">{errors.longitude}</div>}
          </section>

          {/* Paso 5 — Documento */}
          <section className="soil-form__section">
            <div className="soil-form__section-title"><FileText size={14} /> Informe del laboratorio</div>
            <SoilUploader
              file={file}
              onFileSelect={(f, err) => { setFile(f); setFileError(err); }}
              onRemove={() => { setFile(null); setFileError(null); setUploadProgress(null); }}
              progress={uploadProgress}
              error={fileError}
            />
            {isEditing && editing?.hasPdf && !file && (
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                Archivo actual: <strong>{editing.archivoNombre}</strong> — subir uno nuevo lo reemplazará.
              </div>
            )}
          </section>

          {/* Paso 6 — Resultados */}
          <section className="soil-form__section">
            <div className="soil-form__section-title"><FlaskConical size={14} /> Resultados del análisis</div>
            {resultsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6B7280' }}>
                <Loader2 size={14} className="animate-spin" /> Cargando resultados...
              </div>
            ) : (
              <SoilResultsForm results={results} parametros={parametros} onChange={setResults} />
            )}
          </section>

          {saveError && (
            <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12 }}>
              {saveError}
            </div>
          )}
        </div>

        <div className="soil-form__footer">
          <button type="button" className="fert-btn fert-btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="fert-btn fert-btn--outline"
            onClick={() => handleSave('borrador')}
            disabled={saving}
            style={{ fontSize: 13 }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar borrador
          </button>
          <button
            type="button"
            className="fert-btn fert-btn--primary"
            onClick={() => handleSave('completo')}
            disabled={saving}
            style={{ fontSize: 13 }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEditing ? 'Guardar cambios' : 'Guardar y completar'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default SoilFormDrawer;
