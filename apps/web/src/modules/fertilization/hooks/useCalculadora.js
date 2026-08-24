/**
 * useCalculadora.js
 * Hook principal de la Calculadora de Fertilizacion.
 *
 * Flujo (4 pasos):
 *   1. Información        → lote, cultivo, área, plantas/ha, etapa, rendimiento
 *   2. Análisis y Diagnóstico → análisis de suelo (el motor deriva requerimientos)
 *   3. Fuentes Fertilizantes  → el usuario registra productos, composición,
 *                               presentación, precio opcional y disponibilidad
 *   4. Recomendación      → el FertilizationEngine resuelve la formulación
 *
 * Conecta con las rutas del backend:
 *   GET  /api/v1/fertilizacion/calculo/cultivos
 *   GET  /api/v1/fertilizacion/calculo/cultivos/:cropId/etapas
 *   GET  /api/v1/fertilizacion/calculo/fertilizantes
 *   POST /api/v1/fertilizacion/calculo
 *
 * REGLA: el frontend NUNCA calcula la recomendación ni usa datos mock.
 * Si el backend no responde, se muestra el error; no se inventan números.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fertilizationMasterDataApi } from '../api/fertilization-master-data.api.js';

const BACKEND_URL = import.meta.env.DEV
  ? 'http://localhost:3000/api/v1'
  : 'https://backend.skycrop.app/api/v1';

const DEFAULT_CROPS = [
  { id: 'cacao',   name: 'Cacao',    scientificName: 'Theobroma cacao',     unit: 't/ha' },
  { id: 'maiz',    name: 'Maiz',     scientificName: 'Zea mays',            unit: 't/ha' },
  { id: 'soya',    name: 'Soya',     scientificName: 'Glycine max',         unit: 't/ha' },
  { id: 'yuca',    name: 'Yuca',     scientificName: 'Manihot esculenta',   unit: 't/ha' },
  { id: 'platano', name: 'Platano',  scientificName: 'Musa paradisiaca',    unit: 't/ha' },
  { id: 'cafe',    name: 'Cafe',     scientificName: 'Coffea arabica',      unit: 't/ha' },
  { id: 'arroz',   name: 'Arroz',    scientificName: 'Oryza sativa',        unit: 't/ha' },
  { id: 'banano',  name: 'Banano',   scientificName: 'Musa acuminata',      unit: 't/ha' },
];

const DEFAULT_STAGES_MAP = {
  cacao:   [
    { id: 'vegetativo', name: 'Vegetativo', weeks: '0-8' },
    { id: 'floracion',  name: 'Floracion',  weeks: '8-16' },
    { id: 'llenado',    name: 'Llenado',    weeks: '16-28' },
    { id: 'maduracion', name: 'Maduracion', weeks: '28-36' },
  ],
  maiz:    [
    { id: 'germinacion', name: 'Germinacion (VE-V3)', weeks: '0-3' },
    { id: 'vegetativo',  name: 'Vegetativo (V4-V10)', weeks: '3-10' },
    { id: 'floracion',   name: 'Floracion (VT-R1)',   weeks: '10-14' },
    { id: 'grano',       name: 'Llenado de Grano',    weeks: '14-22' },
  ],
  soya:    [
    { id: 'vegetativo', name: 'Vegetativo (V1-V6)',       weeks: '0-6' },
    { id: 'floracion',  name: 'Floracion (R1-R2)',        weeks: '6-10' },
    { id: 'vaina',      name: 'Formacion de Vaina (R3)',  weeks: '10-15' },
    { id: 'madurez',    name: 'Madurez (R6-R8)',          weeks: '15-20' },
  ],
  default: [
    { id: 'vegetativo',  name: 'Vegetativo',  weeks: '0-8'   },
    { id: 'floracion',   name: 'Floracion',   weeks: '8-16'  },
    { id: 'produccion',  name: 'Produccion',  weeks: '16-28' },
    { id: 'maduracion',  name: 'Maduracion',  weeks: '28-36' },
  ],
};

/** Nutrientes editables por fila de fuente (composición dinámica en %). */
export const SOURCE_NUTRIENTS = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S', 'B', 'Zn'];

const emptyComposition = () =>
  Object.fromEntries(SOURCE_NUTRIENTS.map((n) => [n, '']));

const newSourceRow = () => ({
  key: crypto.randomUUID(),
  name: '',
  composition: emptyComposition(),
  presentationKg: '50',
  pricePerUnit: '',
  available: true,
});

const INITIAL_FORM = {
  lotId: '', lotName: '', areaHa: 0,
  cropId: '', cropName: '', variedad: '',
  stageId: '', stageName: '',
  plantsHa: '',
  fechaSiembra: '', sistemaProductivo: 'convencional',
  applicationMethod: 'granular',
  targetYieldTHa: '', removeResidues: false, notes: '',
  soilAnalysisId: '',
  soil: { pH: '', organicMatter: '', N: '', P: '', K: '', Ca: '', Mg: '', S: '', texture: 'franco', cec: '' },
  fechaAnalisis: '', laboratorio: '', profundidadMuestreo: '0-20',
};

/**
 * Normaliza una fila de fuente del frontend al contrato del motor.
 * '' → null; strings numéricos → number; composición solo con valores > 0.
 */
function sourceToPayload(row) {
  const composition = {};
  for (const [nutrient, value] of Object.entries(row.composition)) {
    const num = parseFloat(value);
    if (!Number.isNaN(num) && num > 0) composition[nutrient] = num;
    else if (value !== '' && !Number.isNaN(num)) composition[nutrient] = null;
  }
  return {
    name: row.name.trim(),
    composition,
    presentationKg: row.presentationKg === '' || parseFloat(row.presentationKg) <= 0
      ? null
      : parseFloat(row.presentationKg),
    pricePerUnit: row.pricePerUnit === '' || parseFloat(row.pricePerUnit) <= 0
      ? null
      : parseFloat(row.pricePerUnit),
    available: Boolean(row.available),
  };
}

/** Valida las fuentes registradas en el Paso 3. Devuelve mapa de errores por índice. */
function validateSources(sources) {
  if (!sources.length) return { _global: 'Agrega al menos una fuente fertilizante.' };
  const errors = {};
  sources.forEach((row, i) => {
    const errs = {};
    if (!row.name.trim()) errs.name = 'Nombre requerido';
    const values = Object.values(row.composition)
      .map((v) => parseFloat(v))
      .filter((v) => !Number.isNaN(v));
    const positives = values.filter((v) => v > 0);
    if (positives.length === 0) errs.composition = 'Registra al menos un nutriente con valor > 0';
    else if (positives.some((v) => v > 100)) errs.composition = 'Ningún nutriente puede superar 100%';
    else if (positives.reduce((s, v) => s + v, 0) > 100) errs.composition = 'La suma de la composición supera 100%';
    if (Object.keys(errs).length) errors[i] = errs;
  });
  return Object.keys(errors).length ? errors : null;
}

export function useCalculadora(companyId = null) {
  const [step, setStep]               = useState(1);
  const [form, setForm]               = useState(INITIAL_FORM);
  const [errors, setErrors]           = useState({});
  const [calculating, setCalculating] = useState(false);
  const [result, setResult]           = useState(null);
  const [calcError, setCalcError]     = useState(null);

  // ── Paso 3: fuentes fertilizantes registradas por el usuario ──────────────
  const [sources, setSources]         = useState([newSourceRow()]);
  const [sourceErrors, setSourceErrors] = useState({});

  /** Unidad de presentación de dosis (display-only; el motor usa kg/ha). */
  const [displayUnit, setDisplayUnit] = useState('kg_ha');

  const [lotes, setLotes]             = useState([]);
  const [crops, setCrops]             = useState([]);
  /** Etapas por cultivo cargadas del backend: { [cropId]: stages[] }. */
  const [stageCatalog, setStageCatalog] = useState({});
  /** Catálogo maestro para PRE-FILAR composiciones (nunca se asumen: el usuario confirma/edita). */
  const [fertilizerCatalog, setFertilizerCatalog] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  const abortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCatalogs(true);
      try {
        const lotesData = await fertilizationMasterDataApi.getLotes(companyId);
        if (!cancelled) setLotes(lotesData);

        let cropsData = DEFAULT_CROPS;
        try {
          const r = await fetch(`${BACKEND_URL}/fertilizacion/calculo/cultivos`);
          if (r.ok) { const j = await r.json(); if (j.success && j.data?.length) cropsData = j.data; }
        } catch { /* backend no disponible: se mantiene lista base de UI */ }
        if (!cancelled) setCrops(cropsData);

        try {
          const r = await fetch(`${BACKEND_URL}/fertilizacion/calculo/fertilizantes`);
          if (r.ok) {
            const j = await r.json();
            if (j.success && Array.isArray(j.data)) {
              if (!cancelled) setFertilizerCatalog(j.data);
            }
          }
        } catch { /* catálogo de fertilizantes no disponible: registro manual */ }
      } catch (err) {
        console.warn('[useCalculadora] Error cargando catalogos:', err.message);
      } finally {
        if (!cancelled) setLoadingCatalogs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  useEffect(() => {
    const cropId = form.cropId;
    if (!cropId || stageCatalog[cropId]) return undefined;
    let cancelled = false;
    (async () => {
      let stagesData = null;
      try {
        const r = await fetch(`${BACKEND_URL}/fertilizacion/calculo/cultivos/${cropId}/etapas`);
        if (r.ok) {
          const j = await r.json();
          if (j.success && j.data?.length) stagesData = j.data;
        }
      } catch { /* etapas del backend no disponibles */ }
      if (!cancelled && stagesData) {
        setStageCatalog(prev => ({ ...prev, [cropId]: stagesData }));
      }
    })();
    return () => { cancelled = true; };
  }, [form.cropId, stageCatalog]);

  const selectLote = useCallback((loteId) => {
    const lote = lotes.find(l => l.id === loteId);
    if (!lote) return;
    setForm(f => ({ ...f, lotId: lote.id, lotName: lote.nombre, areaHa: lote.area_ha || 0, cropName: lote.cultivo || f.cropName }));
  }, [lotes]);  const selectCrop = useCallback((cropId) => {
    const crop = crops.find(c => c.id === cropId);
    setForm(f => ({ ...f, cropId, cropName: crop?.name || cropId, stageId: '', stageName: '' }));
  }, [crops]);

  const updateField = useCallback((field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  const updateSoil = useCallback((field, value) => {
    setForm(f => ({ ...f, soil: { ...f.soil, [field]: value } }));
  }, []);

  // ─── Gestión de fuentes fertilizantes (Paso 3) ─────────────────────────────

  const addSource = useCallback(() => {
    setSources(s => [...s, newSourceRow()]);
  }, []);

  const removeSource = useCallback((key) => {
    setSources(s => (s.length <= 1 ? s : s.filter(src => src.key !== key)));
    setSourceErrors({});
  }, []);

  const updateSource = useCallback((key, field, value) => {
    setSources(s => s.map(src => (src.key === key ? { ...src, [field]: value } : src)));
    setSourceErrors({});
  }, []);

  const updateSourceComposition = useCallback((key, nutrient, value) => {
    setSources(s => s.map(src => (
      src.key === key
        ? { ...src, composition: { ...src.composition, [nutrient]: value } }
        : src
    )));
    setSourceErrors({});
  }, []);

  /**
   * Pre-fila una fila desde el catálogo maestro.
   * La composición queda visible y editable: el usuario siempre confirma (§27.2).
   */
  const loadFromCatalog = useCallback((key, fertilizerId) => {
    const fert = fertilizerCatalog.find(f => f.id === fertilizerId);
    if (!fert) return;
    setSources(s => s.map(src => {
      if (src.key !== key) return src;
      const composition = { ...emptyComposition() };
      for (const [code, pct] of Object.entries(fert.composition ?? {})) {
        if (SOURCE_NUTRIENTS.includes(code) && typeof pct === 'number') {
          composition[code] = String(pct);
        }
      }
      return {
        ...src,
        name: fert.commercialName || src.name,
        composition,
        masterFertilizerId: fert.id,
        minDoseKgHa: fert.minDoseKgHa ?? null,
        maxDoseKgHa: fert.maxDoseKgHa ?? null,
      };
    }));
    setSourceErrors({});
  }, [fertilizerCatalog]);

  const sourcesValid = useCallback(() => validateSources(sources) === null, [sources]);

  const validateStep = useCallback((s = step) => {
    const errs = {};
    if (s === 1) {
      if (!form.cropId)  errs.cropId  = 'Selecciona un cultivo';
      if (!form.stageId) errs.stageId = 'Selecciona la etapa fenologica';
      if (!form.targetYieldTHa || parseFloat(form.targetYieldTHa) <= 0)
        errs.targetYieldTHa = 'Ingresa un rendimiento objetivo mayor a 0';
    }
    if (s === 3) {
      const srcErrs = validateSources(sources);
      if (srcErrs) {
        errs.sourcesGlobal = srcErrs._global || 'Revisa las fuentes fertilizantes marcadas.';
        setSourceErrors(srcErrs);
      } else {
        setSourceErrors({});
      }
    }
    setErrors(e => ({ ...e, ...errs }));
    return Object.keys(errs).length === 0;
  }, [step, form, sources]);

  const goNext = useCallback(() => {
    if (!validateStep(step)) return;
    if (step < 4) setStep(s => s + 1);
  }, [step, validateStep]);

  const goPrev = useCallback(() => { if (step > 1) setStep(s => s - 1); }, [step]);
  const goToStep = useCallback((s) => { if (s >= 1 && s <= 4) setStep(s); }, []);

  // ─── Cálculo: el frontend solo envía parámetros; el motor formula ──────────

  const calculate = useCallback(async () => {
    if (!validateStep(1)) { setStep(1); return; }
    if (!validateStep(3)) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const plantsHaNum = parseFloat(form.plantsHa);

    const payload = {
      cropId:             form.cropId,
      stageId:            form.stageId,
      targetYieldTHa:     parseFloat(form.targetYieldTHa),
      methodology:        form.methodology || 'extraction',
      applicationMethod:  form.applicationMethod || 'granular',
      areaHa:             parseFloat(form.areaHa) > 0 ? parseFloat(form.areaHa) : undefined,
      plantsHa:           !Number.isNaN(plantsHaNum) && plantsHaNum > 0 ? plantsHaNum : undefined,
      lotId:              form.lotId || undefined,
      soilAnalysisId:     form.soilAnalysisId || undefined,
      fertilizerSources:  sources.map(sourceToPayload),
    };

    setCalculating(true);
    setCalcError(null);
    setResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/fertilizacion/calculo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || `Error ${res.status}`);
      }
      const json = await res.json();
      setResult(json.data || json);
      setStep(4);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[useCalculadora] Error del motor:', err.message);
      setCalcError(
        `No se pudo calcular la recomendación: ${err.message}. Verifica tu conexión con el servidor e inténtalo de nuevo.`
      );
    } finally {
      setCalculating(false);
    }
  }, [form, sources, validateStep]);

  const reset = useCallback(() => {
    setForm(INITIAL_FORM);
    setResult(null);
    setCalcError(null);
    setErrors({});
    setSources([newSourceRow()]);
    setSourceErrors({});
    setDisplayUnit('kg_ha');
    setStep(1);
  }, []);

  /** Etapas del cultivo seleccionado: backend → base de UI (derivado, sin efecto extra). */
  const stages = stageCatalog[form.cropId]
    ?? DEFAULT_STAGES_MAP[form.cropId]
    ?? DEFAULT_STAGES_MAP.default;

  return {
    step, form, errors, calculating, result, calcError,
    lotes, crops, stages, loadingCatalogs,
    // fuentes fertilizantes
    sources, sourceErrors, displayUnit, setDisplayUnit,
    addSource, removeSource, updateSource, updateSourceComposition,
    loadFromCatalog, fertilizerCatalog, sourcesValid,
    setForm, updateField, updateSoil, selectLote, selectCrop,
    goNext, goPrev, goToStep, calculate, reset,
  };
}
