/**
 * useCalculadora.js
 * Hook principal de la Calculadora de Fertilizacion — Flujo refactorizado §1-§16.
 *
 * Nuevo flujo (4 pasos agronómicamente correcto):
 *   1. Información y análisis de suelo → lote, cultivo, variedad, área, etapa,
 *      fecha siembra, sistema, meta, plantas/ha, método + análisis suelo (pH, MO,
 *      N,P,K,Ca,Mg,S,CIC,textura...). Describe condiciones reales del lote.
 *   2. Requerimientos nutricionales    → qué necesita la planta (demanda). Editor
 *      con fuente: SkyCrop DB | personalizado | extracción × rendimiento | balance.
 *      Incluye tabla editable + distribución % por aplicación + trazabilidad.
 *   3. Balance y recomendación         → Demanda - Oferta = Déficit → Ajuste →
 *      fuentes fertilizantes disponibles → dosis (kg/ha, bultos, g/planta).
 *      Muestra balance nutricional y permite registrar fertilizantes.
 *   4. Resumen                         → dosis exactas por lote/aplicación.
 *
 * Arquitectura motor:
 *   SoilSupplyEngine (oferta) + Requirement (demanda) → NutrientBalanceEngine
 *   → AdjustmentEngine → FertilizerEngine → Recommendation
 *
 * Conecta con backend:
 *   GET  /calculo/cultivos  | /cultivos/:id/etapas | /fertilizantes | /requerimientos
 *   POST /calculo  | POST /calculo/balance-preview
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fertilizationMasterDataApi } from '../api/fertilization-master-data.api.js';
import { calculateNutrientContribution } from '../calculations/nutrientCalculations.js';

const BACKEND_URL = import.meta.env.DEV
  ? 'http://localhost:3000/api/v1'
  : 'https://backend.skycrop.app/api/v1';

const DEFAULT_CROPS = [
  { id: '11111111-0000-0000-0000-000000000001', name: 'Cacao',    scientificName: 'Theobroma cacao',     unit: 't/ha' },
  { id: '11111111-0000-0000-0000-000000000003', name: 'Maiz',     scientificName: 'Zea mays',            unit: 't/ha' },
  { id: 'soya',    name: 'Soya',     scientificName: 'Glycine max',         unit: 't/ha' },
  { id: 'yuca',    name: 'Yuca',     scientificName: 'Manihot esculenta',   unit: 't/ha' },
  { id: 'platano', name: 'Platano',  scientificName: 'Musa paradisiaca',    unit: 't/ha' },
  { id: '11111111-0000-0000-0000-000000000002', name: 'Cafe',     scientificName: 'Coffea arabica',      unit: 't/ha' },
  { id: '11111111-0000-0000-0000-000000000004', name: 'Arroz',    scientificName: 'Oryza sativa',        unit: 't/ha' },
  { id: 'banano',  name: 'Banano',   scientificName: 'Musa acuminata',      unit: 't/ha' },
];

const DEFAULT_STAGES_MAP = {
  cacao:   [
    { id: '22222222-0000-0000-0000-000000000002', name: 'Desarrollo Vegetativo', weeks: '0-8' },
    { id: '22222222-0000-0000-0000-000000000003', name: 'Floración',  weeks: '8-16' },
    { id: '22222222-0000-0000-0000-000000000004', name: 'Llenado de Mazorca',    weeks: '16-28' },
    { id: '22222222-0000-0000-0000-000000000005', name: 'Maduración', weeks: '28-36' },
    { id: '22222222-0000-0000-0000-000000000006', name: 'Producción (Ciclo)', weeks: '0-36' },
  ],
  '11111111-0000-0000-0000-000000000001': [
    { id: '22222222-0000-0000-0000-000000000002', name: 'Desarrollo Vegetativo', weeks: '0-8' },
    { id: '22222222-0000-0000-0000-000000000003', name: 'Floración',  weeks: '8-16' },
    { id: '22222222-0000-0000-0000-000000000004', name: 'Llenado de Mazorca',    weeks: '16-28' },
    { id: '22222222-0000-0000-0000-000000000005', name: 'Maduración', weeks: '28-36' },
    { id: '22222222-0000-0000-0000-000000000006', name: 'Producción (Ciclo)', weeks: '0-36' },
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
/** Nutrientes del Paso 2 — Requerimientos (tabla principal) */
export const REQUIREMENT_NUTRIENTS = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S', 'B', 'Zn', 'Fe', 'Mn', 'Cu'];
export const REQUIREMENT_UNITS = {
  N: 'kg/ha', P2O5: 'kg/ha', K2O: 'kg/ha', Ca: 'kg/ha', Mg: 'kg/ha', S: 'kg/ha',
  B: 'g/ha', Zn: 'g/ha', Fe: 'g/ha', Mn: 'g/ha', Cu: 'g/ha',
};
const DEFAULT_REQUIREMENTS = {
  N: '120', P2O5: '40', K2O: '180', Ca: '35', Mg: '20', S: '15', B: '500', Zn: '800',
};
const DEFAULT_DISTRIBUTIONS = {
  N: '30', P2O5: '30', K2O: '40', Ca: '30', Mg: '30', S: '30', B: '30', Zn: '30',
};
const DEFAULT_EXTRACTION_COEFFS = {
  N: '16', P2O5: '6', K2O: '24', Ca: '8', Mg: '4', S: '3',
};

const emptyComposition = () =>
  Object.fromEntries(SOURCE_NUTRIENTS.map((n) => [n, '']));

const newSourceRow = () => ({
  key: crypto.randomUUID(),
  name: '',
  composition: emptyComposition(),
  presentationKg: '50',
  pricePerUnit: '',
  available: true,
  doseKgHa: '', // dosis editable para Excel dinámico (kg/ha)
});

const INITIAL_FORM = {
  lotId: '', lotName: '', areaHa: 0, sectorName: '', farmName: '',
  cropId: '', cropName: '', variedad: '',
  stageId: '', stageName: '',
  plantsHa: '',
  fechaSiembra: '', sistemaProductivo: 'convencional',
  applicationMethod: 'granular',
  targetYieldTHa: '', removeResidues: false, notes: '',
  soilAnalysisId: '',
  methodology: 'extraction',
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

  // ── Paso 2: Requerimientos nutricionales (editor agronómico) ───────────────
  const [requirementSource, setRequirementSource] = useState('custom'); // skycrop_db | custom | extraction | balance
  const [requirements, setRequirements] = useState({ ...DEFAULT_REQUIREMENTS });
  const [distributions, setDistributions] = useState({ ...DEFAULT_DISTRIBUTIONS });
  const [extractionCoeffs, setExtractionCoeffs] = useState({ ...DEFAULT_EXTRACTION_COEFFS });
  const [requirementMeta, setRequirementMeta] = useState({
    stagePct: '100',
    efficiency: '',
    correctionFactor: '',
    bibliographicSource: '',
    sourceDocument: '',
    sourceYear: '',
    sourcePage: '',
    observations: '',
  });
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [requirementsError, setRequirementsError] = useState(null);

  // ── Paso 3: fuentes fertilizantes + balance preview ────────────────────────
  const [sources, setSources]         = useState([newSourceRow()]);
  const [sourceErrors, setSourceErrors] = useState({});
  const [balancePreview, setBalancePreview] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

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

  // ─── Paso 2 — Requerimientos nutricionales ──────────────────────────────────

  const updateRequirement = useCallback((code, value) => {
    setRequirements(r => ({ ...r, [code]: value }));
  }, []);

  const updateDistribution = useCallback((code, value) => {
    setDistributions(d => ({ ...d, [code]: value }));
  }, []);

  const updateExtractionCoeff = useCallback((code, value) => {
    setExtractionCoeffs(prev => {
      const next = { ...prev, [code]: value };
      // Si fuente = extraction, recalcular requerimiento automáticamente: coeff × yield
      if (requirementSource === 'extraction') {
        const yieldVal = parseFloat(form.targetYieldTHa);
        const coeff = parseFloat(value);
        if (!Number.isNaN(yieldVal) && yieldVal > 0 && !Number.isNaN(coeff) && coeff >= 0) {
          setRequirements(r => ({ ...r, [code]: String(parseFloat((coeff * yieldVal).toFixed(2))) }));
        }
      }
      return next;
    });
  }, [requirementSource, form.targetYieldTHa]);

  const updateRequirementMeta = useCallback((field, value) => {
    setRequirementMeta(m => ({ ...m, [field]: value }));
  }, []);

  const addRequirementNutrient = useCallback((code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setRequirements(r => (r[trimmed] !== undefined ? r : { ...r, [trimmed]: '' }));
    setDistributions(d => (d[trimmed] !== undefined ? d : { ...d, [trimmed]: '30' }));
  }, []);

  const removeRequirementNutrient = useCallback((code) => {
    setRequirements(r => { const n = { ...r }; delete n[code]; return n; });
    setDistributions(d => { const n = { ...d }; delete n[code]; return n; });
  }, []);

  /**
   * Carga requerimientos desde SkyCrop DB escalados por cultivo+etapa+meta.
   * Usa el nuevo endpoint GET /calculo/requerimientos
   */
  const fetchRequirements = useCallback(async () => {
    if (!form.cropId || !form.stageId || !form.targetYieldTHa) {
      setRequirementsError('Selecciona cultivo, etapa y meta productiva primero');
      return;
    }
    setLoadingRequirements(true);
    setRequirementsError(null);
    try {
      const params = new URLSearchParams({
        cropId: form.cropId,
        stageId: form.stageId,
        targetYieldTHa: String(parseFloat(form.targetYieldTHa)),
        methodology: form.methodology || 'extraction',
      });
      if (form.sistemaProductivo) params.set('productionSystem', form.sistemaProductivo);
      if (form.variedad) params.set('variety', form.variedad);
      const r = await fetch(`${BACKEND_URL}/fertilizacion/calculo/requerimientos?${params.toString()}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error?.message || j.message || `Error ${r.status}`);
      }
      const j = await r.json();
      const reqs = j.data?.requirements || j.data || {};
      if (reqs && typeof reqs === 'object' && Object.keys(reqs).length) {
        // Convertir kg/ha a unidad de UI (g/ha para micro)
        const nextReqs = { ...requirements };
        for (const [code, kgVal] of Object.entries(reqs)) {
          const unit = REQUIREMENT_UNITS[code] || 'kg/ha';
          const isMicro = unit === 'g/ha';
          const displayVal = isMicro ? Number(kgVal) * 1000 : Number(kgVal);
          nextReqs[code] = String(parseFloat(displayVal.toFixed(2)));
        }
        setRequirements(nextReqs);
        setRequirementSource('skycrop_db');
      } else {
        setRequirementsError('No se encontraron requerimientos para esa combinación. Usa personalizado.');
      }
    } catch (err) {
      setRequirementsError(err.message);
    } finally {
      setLoadingRequirements(false);
    }
  }, [form.cropId, form.stageId, form.targetYieldTHa, form.methodology, form.sistemaProductivo, form.variedad, requirements]);

  // Recalcular extracciones cuando cambia rendimiento en modo extraction
  useEffect(() => {
    if (requirementSource !== 'extraction') return;
    const y = parseFloat(form.targetYieldTHa);
    if (!y || y <= 0) return;
    const next = {};
    let changed = false;
    for (const [code, coeffStr] of Object.entries(extractionCoeffs)) {
      const coeff = parseFloat(coeffStr);
      if (Number.isFinite(coeff) && coeff >= 0) {
        const newVal = String(parseFloat((coeff * y).toFixed(2)));
        if (requirements[code] !== newVal) {
          next[code] = newVal;
          changed = true;
        }
      }
    }
    if (changed) setRequirements(r => ({ ...r, ...next }));
  }, [form.targetYieldTHa, requirementSource]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableNutrients = useMemo(() => {
    const all = [...REQUIREMENT_NUTRIENTS];
    for (const code of Object.keys(requirements)) {
      if (!all.includes(code)) all.push(code);
    }
    return all;
  }, [requirements]);

  const totalRequirementSummary = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const [code, val] of Object.entries(requirements)) {
      const n = parseFloat(val);
      if (Number.isFinite(n) && n > 0) {
        const unit = REQUIREMENT_UNITS[code] || 'kg/ha';
        const kg = unit === 'g/ha' ? n / 1000 : n;
        const pct = parseFloat(distributions[code] ?? 100);
        total += kg * (Number.isFinite(pct) ? pct / 100 : 1);
        count++;
      }
    }
    return { totalKgHa: total, nutrientCount: count };
  }, [requirements, distributions]);

  // ─── Balance en tiempo real (Excel dinámico) — frontend puro, sin backend ───────
  // Calcula aporte fertilizante sumando dosis*composición y lo compara con déficit
  const realTimeBalance = useMemo(() => {
    // Requerimientos en kg/ha (micro convertidos)
    const reqKgHa = {};
    for (const [code, val] of Object.entries(requirements)) {
      const n = parseFloat(val);
      if (!Number.isFinite(n) || n <= 0) continue;
      const unit = REQUIREMENT_UNITS[code] || 'kg/ha';
      const kg = unit === 'g/ha' ? n / 1000 : n;
      const pct = parseFloat(distributions[code] ?? 100);
      reqKgHa[code] = kg * (Number.isFinite(pct) ? pct / 100 : 1);
    }
    // Aporte suelo desde balancePreview (backend agronómico) o estimación local Excel si backend no disponible
    let soilContribs = balancePreview?.soilContributions || {};
    // Fallback local: estimar suelo a partir de form.soil si preview vacío y hay datos de suelo
    if (Object.keys(soilContribs).length === 0 && form.soil) {
      const local = {};
      const s = form.soil;
      const bulk = 1.3;
      const depthRaw = form.profundidadMuestreo;
      const depth = depthRaw === '0-30' ? 30 : depthRaw === '0-40' ? 40 : depthRaw === '20-40' ? 20 : 20;
      const mgKgToKgHa = (mg) => mg * 10000 * (depth/100) * bulk / 1000;
      const pH = parseFloat(s.pH);
      // N estimado desde MO: 20 kg N por % MO * disponibilidad 0.5 (ajustado por pH)
      const om = parseFloat(s.organicMatter);
      if (Number.isFinite(om) && om > 0) {
        const nTotal = om * 20;
        let avail = 0.5;
        if (Number.isFinite(pH) && (pH < 5.5 || pH > 7.5)) avail *= 0.8;
        local.N = nTotal * avail;
      }
      // P ppm -> kg P2O5/ha
      const pVal = parseFloat(s.P);
      if (Number.isFinite(pVal) && pVal >= 0) {
        const pKgHa = mgKgToKgHa(pVal);
        const p2o5KgHa = pKgHa * 2.2914;
        let avail = 0.2;
        if (Number.isFinite(pH) && (pH < 5.5 || pH > 7.5)) avail *= 0.5;
        local.P2O5 = p2o5KgHa * avail;
        local.P = pKgHa * 0.2;
      }
      // K cmol -> kg K2O/ha
      const kVal = parseFloat(s.K);
      if (Number.isFinite(kVal) && kVal >= 0) {
        const kMgKg = kVal * 391;
        const kKgHa = mgKgToKgHa(kMgKg);
        const k2oKgHa = kKgHa * 1.2046;
        local.K2O = k2oKgHa * 0.8;
        local.K = kKgHa * 0.8;
      }
      const caVal = parseFloat(s.Ca);
      if (Number.isFinite(caVal) && caVal >= 0) {
        const caMgKg = caVal * 200.4;
        const caKgHa = mgKgToKgHa(caMgKg);
        local.Ca = caKgHa * 0.9;
      }
      const mgVal = parseFloat(s.Mg);
      if (Number.isFinite(mgVal) && mgVal >= 0) {
        const mgMgKg = mgVal * 121.55;
        const mgKgHa = mgKgToKgHa(mgMgKg);
        local.Mg = mgKgHa * 0.85;
      }
      const sVal = parseFloat(s.S);
      if (Number.isFinite(sVal) && sVal >= 0) {
        const sKgHa = mgKgToKgHa(sVal);
        local.S = sKgHa * 0.6;
      }
      // Solo usar local si tiene al menos un valor
      if (Object.keys(local).length) soilContribs = local;
    }
    // Aporte fertilizante: suma de dosis * composición
    const fertContribs = {};
    for (const src of sources) {
      if (!src.available) continue;
      const dose = parseFloat(src.doseKgHa);
      if (!Number.isFinite(dose) || dose <= 0) continue;
      const contrib = calculateNutrientContribution(dose, src.composition);
      for (const [nut, kg] of Object.entries(contrib)) {
        fertContribs[nut] = (fertContribs[nut] || 0) + kg;
        // también manejar equivalencias P<->P2O5, K<->K2O si el requerimiento usa óxido
        // Si el fertilizante aporta P pero el requerimiento es P2O5, convertir (2.2914)
        // Usamos factores simples
        if (nut === 'P' && reqKgHa.P2O5 !== undefined && fertContribs.P2O5 === undefined) {
          // P elemental a P2O5
          fertContribs.P2O5 = (fertContribs.P2O5 || 0) + kg * 2.2914;
        }
        if (nut === 'K' && reqKgHa.K2O !== undefined) {
          fertContribs.K2O = (fertContribs.K2O || 0) + kg * 1.2046;
        }
      }
    }
    // Balance por nutriente: requerimiento | suelo | déficit | aporte fert | balance | cobertura | estado
    const allCodes = new Set([...Object.keys(reqKgHa), ...Object.keys(soilContribs), ...Object.keys(fertContribs)]);
    const rows = {};
    let hasDeficit = false;
    let hasExcess = false;
    for (const code of allCodes) {
      const req = reqKgHa[code] ?? 0;
      if (req <= 0) continue;
      const soil = parseFloat(soilContribs[code] ?? 0) || 0;
      const deficit = Math.max(0, req - soil);
      const fert = fertContribs[code] ?? 0;
      const balance = fert - deficit;
      let coverage, status;
      if (deficit <= 0.01) {
        // Suelo ya cubre el requerimiento — no hay déficit que cubrir
        coverage = fert > 0 ? 100 : 100;
        if (fert > 0.01) {
          const total = soil + fert;
          if (total > req * 1.1) { status = 'excess'; hasExcess = true; }
          else { status = 'adequate'; }
        } else {
          status = 'adequate';
        }
      } else {
        coverage = (fert / deficit) * 100;
        if (coverage < 95) { status = 'deficit'; hasDeficit = true; }
        else if (coverage > 110) { status = 'excess'; hasExcess = true; }
        else { status = 'adequate'; }
      }
      rows[code] = {
        required: parseFloat(req.toFixed(2)),
        soil: parseFloat(soil.toFixed(2)),
        deficit: parseFloat(deficit.toFixed(2)),
        fert: parseFloat(fert.toFixed(2)),
        balance: parseFloat(balance.toFixed(2)),
        coverage: parseFloat(coverage.toFixed(1)),
        status,
      };
    }
    // Ordenar por categorías
    const order = ['N','P2O5','K2O','Ca','Mg','S','B','Zn','Fe','Mn','Cu','Mo','Cl'];
    const sortedRows = Object.fromEntries(
      Object.entries(rows).sort((a,b) => {
        const ia = order.indexOf(a[0]); const ib = order.indexOf(b[0]);
        return (ia===-1?999:ia) - (ib===-1?999:ib);
      })
    );
    return {
      rows: sortedRows,
      fertContribs,
      reqKgHa,
      soilContribs,
      hasDeficit,
      hasExcess,
      totalFertKgHa: Object.values(fertContribs).reduce((s,v)=>s+v,0),
    };
  }, [requirements, distributions, sources, balancePreview, form.soil, form.profundidadMuestreo]);

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

  // Sugerir dosis para cubrir déficit (Excel: helper para no entrar en deficiencia)
  const suggestDoseForSource = useCallback((key) => {
    const src = sources.find(s => s.key === key);
    if (!src) return;
    let primary = null, maxPct = 0;
    for (const [nut, pctStr] of Object.entries(src.composition)) {
      const pct = parseFloat(pctStr);
      if (Number.isFinite(pct) && pct > maxPct) { maxPct = pct; primary = nut; }
    }
    if (!primary || maxPct <= 0) return;
    const baseDeficit = realTimeBalance?.rows?.[primary]?.deficit;
    const target = (baseDeficit !== undefined && baseDeficit !== null) ? baseDeficit : (realTimeBalance?.reqKgHa?.[primary] ?? 0);
    if (!target || target <= 0) return;
    const suggested = target / (maxPct / 100);
    updateSource(key, 'doseKgHa', String(Math.round(suggested)));
  }, [sources, realTimeBalance, updateSource]);

  const autoSuggestAllDoses = useCallback(() => {
    // Greedy: asignar dosis a fuentes vacías para cubrir déficits remanentes
    const remainingDeficits = { ...(realTimeBalance?.rows ? Object.fromEntries(Object.entries(realTimeBalance.rows).map(([k,v]) => [k, v.deficit - (realTimeBalance.fertContribs[k]||0)])) : {}) };
    // Si no hay realTime, usar reqKgHa - soil
    setSources(prev => prev.map(src => {
      if (!src.available) return src;
      if (src.doseKgHa && parseFloat(src.doseKgHa) > 0) return src;
      let primary = null, maxPct = 0;
      for (const [nut, pctStr] of Object.entries(src.composition)) {
        const pct = parseFloat(pctStr);
        if (pct > maxPct) { maxPct = pct; primary = nut; }
      }
      if (!primary || maxPct <= 0) return src;
      const rem = remainingDeficits[primary];
      const target = (rem !== undefined && rem > 0) ? rem : (realTimeBalance?.rows?.[primary]?.deficit ?? 0);
      if (!target || target <= 0) return src;
      const suggested = target / (maxPct / 100);
      // Reducir déficit remanente para siguientes fuentes que compartan nutriente (simple)
      remainingDeficits[primary] = Math.max(0, target - suggested * (maxPct/100));
      return { ...src, doseKgHa: String(Math.round(suggested)) };
    }));
  }, [realTimeBalance]);

  const sourcesValid = useCallback(() => validateSources(sources) === null, [sources]);

  // ─── Balance preview (Paso 3) ─────────────────────────────────────────────
  const fetchBalancePreview = useCallback(async () => {
    if (!form.cropId || !form.stageId || !form.targetYieldTHa) return;
    setLoadingBalance(true);
    try {
      // Convertir requirements UI (g/ha para micro) → kg/ha para motor
      const customRequirements = {};
      for (const [code, val] of Object.entries(requirements)) {
        const n = parseFloat(val);
        if (!Number.isFinite(n) || n <= 0) continue;
        const unit = REQUIREMENT_UNITS[code] || 'kg/ha';
        customRequirements[code] = unit === 'g/ha' ? n / 1000 : n;
      }
      const requirementDistributions = {};
      for (const [code, pctStr] of Object.entries(distributions)) {
        const pct = parseFloat(pctStr);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) requirementDistributions[code] = pct;
      }
      // Soil inline desde Paso 1
      const soilInline = {};
      if (form.soil?.pH !== '' && form.soil?.pH != null) soilInline.pH = parseFloat(form.soil.pH);
      if (form.soil?.organicMatter !== '' && form.soil?.organicMatter != null) soilInline.organicMatter = parseFloat(form.soil.organicMatter);
      if (form.soil?.cec !== '' && form.soil?.cec != null) soilInline.cec = parseFloat(form.soil.cec);
      if (form.soil?.texture) soilInline.texture = form.soil.texture;
      for (const code of ['N','P','K','Ca','Mg','S']) {
        const v = form.soil?.[code];
        if (v !== '' && v != null && !isNaN(Number(v))) soilInline[code] = parseFloat(v);
      }

      const payload = {
        cropId: form.cropId,
        stageId: form.stageId,
        targetYieldTHa: parseFloat(form.targetYieldTHa),
        methodology: form.methodology || 'extraction',
        customRequirements: Object.keys(customRequirements).length ? customRequirements : null,
        requirementDistributions: Object.keys(requirementDistributions).length ? requirementDistributions : null,
        soilAnalysis: Object.keys(soilInline).length ? soilInline : null,
        soilAnalysisId: form.soilAnalysisId || undefined,
      };
      const r = await fetch(`${BACKEND_URL}/fertilizacion/calculo/balance-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const j = await r.json();
      if (j.success && j.data) setBalancePreview(j.data);
    } catch (err) {
      console.warn('[useCalculadora] Balance preview error:', err.message);
      setBalancePreview(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [form.cropId, form.stageId, form.targetYieldTHa, form.methodology, form.soil, form.soilAnalysisId, requirements, distributions]);

  const validateStep = useCallback((s = step) => {
    const errs = {};
    if (s === 1) {
      if (!form.cropId)  errs.cropId  = 'Selecciona un cultivo';
      if (!form.stageId) errs.stageId = 'Selecciona la etapa fenologica';
      if (!form.targetYieldTHa || parseFloat(form.targetYieldTHa) <= 0)
        errs.targetYieldTHa = 'Ingresa un rendimiento objetivo mayor a 0';
    }
    if (s === 2) {
      // Validar requerimientos del Paso 2: al menos N, P2O5, K2O con valor >0
      const hasAtLeastOne = Object.values(requirements).some(v => parseFloat(v) > 0);
      if (!hasAtLeastOne) errs.requirements = 'Define al menos un requerimiento nutricional > 0';
      for (const [code, pctStr] of Object.entries(distributions)) {
        const pct = parseFloat(pctStr);
        if (pctStr !== '' && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
          errs[`dist_${code}`] = 'Distribución debe estar entre 0 y 100';
        }
      }
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
  }, [step, form, sources, requirements, distributions]);

  const goNext = useCallback(() => {
    if (!validateStep(step)) return;
    if (step < 4) setStep(s => s + 1);
  }, [step, validateStep]);

  const goPrev = useCallback(() => { if (step > 1) setStep(s => s - 1); }, [step]);
  const goToStep = useCallback((s) => { if (s >= 1 && s <= 4) setStep(s); }, []);

  // ─── Cálculo: incluye demanda del Paso 2 + oferta del Paso 1 + fertilizantes Paso 3 ─

  const calculate = useCallback(async () => {
    if (!validateStep(1)) { setStep(1); return; }
    if (!validateStep(2)) { setStep(2); return; }
    if (!validateStep(3)) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const plantsHaNum = parseFloat(form.plantsHa);

    // Construir customRequirements en kg/ha (micro convertidos)
    const customRequirements = {};
    for (const [code, val] of Object.entries(requirements)) {
      const n = parseFloat(val);
      if (!Number.isFinite(n) || n <= 0) continue;
      const unit = REQUIREMENT_UNITS[code] || 'kg/ha';
      customRequirements[code] = unit === 'g/ha' ? n / 1000 : n;
    }
    const requirementDistributions = {};
    for (const [code, pctStr] of Object.entries(distributions)) {
      const pct = parseFloat(pctStr);
      if (Number.isFinite(pct) && pct >= 0 && pct <= 100) requirementDistributions[code] = pct;
    }
    const soilInline = {};
    if (form.soil?.pH !== '' && form.soil?.pH != null) soilInline.pH = parseFloat(form.soil.pH);
    if (form.soil?.organicMatter !== '' && form.soil?.organicMatter != null) soilInline.organicMatter = parseFloat(form.soil.organicMatter);
    if (form.soil?.cec !== '' && form.soil?.cec != null) soilInline.cec = parseFloat(form.soil.cec);
    if (form.soil?.texture) soilInline.texture = form.soil.texture;
    for (const code of ['N','P','K','Ca','Mg','S']) {
      const v = form.soil?.[code];
      if (v !== '' && v != null && !isNaN(Number(v))) soilInline[code] = parseFloat(v);
    }

    const payload = {
      cropId:             form.cropId,
      stageId:            form.stageId,
      targetYieldTHa:     parseFloat(form.targetYieldTHa),
      methodology:        form.methodology || 'extraction',
      requirementSource:  requirementSource || 'custom',
      customRequirements: Object.keys(customRequirements).length ? customRequirements : undefined,
      requirementDistributions: Object.keys(requirementDistributions).length ? requirementDistributions : undefined,
      variety:           form.variedad || undefined,
      productionSystem:  form.sistemaProductivo || undefined,
      applicationMethod:  form.applicationMethod || 'granular',
      areaHa:             parseFloat(form.areaHa) > 0 ? parseFloat(form.areaHa) : undefined,
      plantsHa:           !Number.isNaN(plantsHaNum) && plantsHaNum > 0 ? plantsHaNum : undefined,
      lotId:              form.lotId || undefined,
      soilAnalysisId:     form.soilAnalysisId || undefined,
      soilAnalysis:       Object.keys(soilInline).length ? soilInline : undefined,
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
  }, [form, sources, requirements, distributions, requirementSource, validateStep]);

  const reset = useCallback(() => {
    setForm(INITIAL_FORM);
    setResult(null);
    setCalcError(null);
    setErrors({});
    setRequirements({ ...DEFAULT_REQUIREMENTS });
    setDistributions({ ...DEFAULT_DISTRIBUTIONS });
    setExtractionCoeffs({ ...DEFAULT_EXTRACTION_COEFFS });
    setRequirementMeta({
      stagePct: '100', efficiency: '', correctionFactor: '',
      bibliographicSource: '', sourceDocument: '', sourceYear: '', sourcePage: '', observations: ''
    });
    setRequirementSource('custom');
    setBalancePreview(null);
    setRequirementsError(null);
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
    // Paso 2 — requerimientos
    requirementSource, setRequirementSource,
    requirements, distributions, extractionCoeffs,
    updateRequirement, updateDistribution, updateExtractionCoeff,
    addRequirementNutrient, removeRequirementNutrient,
    requirementMeta, updateRequirementMeta,
    loadingRequirements, requirementsError, fetchRequirements,
    availableNutrients, totalRequirementSummary,
    // balance preview + tiempo real
    balancePreview, loadingBalance, fetchBalancePreview,
    realTimeBalance,
    // fuentes fertilizantes
    sources, sourceErrors, displayUnit, setDisplayUnit,
    addSource, removeSource, updateSource, updateSourceComposition,
    loadFromCatalog, fertilizerCatalog, sourcesValid,
    suggestDoseForSource, autoSuggestAllDoses,
    setForm, updateField, updateSoil, selectLote, selectCrop,
    goNext, goPrev, goToStep, calculate, reset,
  };
}
