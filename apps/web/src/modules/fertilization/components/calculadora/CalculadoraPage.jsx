/**
 * CalculadoraPage.jsx
 * Calculadora de Fertilización — Vista con stepper de 4 pasos.
 *
 *   1. Información            → lote, cultivo, área, plantas/ha, etapa, meta
 *   2. Análisis y Diagnóstico → análisis de suelo (requerimientos los deriva el motor)
 *   3. Fuentes Fertilizantes  → el usuario registra productos y composiciones
 *   4. Recomendación          → resultado del FertilizationEngine (kg/ha, bultos,
 *                               g/planta, aporte real, cobertura %, déficit/exceso)
 *
 * El frontend nunca calcula la recomendación: captura parámetros y muestra
 * resultados del motor determinístico del backend via useCalculadora.
 */
import { Fragment } from 'react';
import {
  Leaf, ChevronRight, ChevronLeft, Calculator, Save,
  CheckCircle, AlertTriangle, Info, FlaskConical,
  Beaker, BarChart2, ClipboardList, Loader2, RotateCcw,
  ArrowRight, Sparkles, Download, XCircle,
} from 'lucide-react';
import { useCalculadora } from '../../hooks/useCalculadora.js';
import Step3Sources from './Step3Sources.jsx';

const NUTRIENT_LABELS = {
  N: 'Nitrógeno (N)', P2O5: 'Fósforo (P₂O₅)', K2O: 'Potasio (K₂O)',
  Ca: 'Calcio (Ca)', Mg: 'Magnesio (Mg)', S: 'Azufre (S)',
  B: 'Boro (B)', Zn: 'Zinc (Zn)',
};
const NCOL = {
  N: { bg: 'rgba(37,99,235,.1)', border: 'rgba(37,99,235,.25)', text: '#2563EB', bar: '#3B82F6' },
  P2O5: { bg: 'rgba(234,88,12,.1)', border: 'rgba(234,88,12,.25)', text: '#EA580C', bar: '#F97316' },
  K2O: { bg: 'rgba(124,58,237,.1)', border: 'rgba(124,58,237,.25)', text: '#7C3AED', bar: '#8B5CF6' },
  Ca: { bg: 'rgba(5,150,105,.1)', border: 'rgba(5,150,105,.25)', text: '#059669', bar: '#10B981' },
  Mg: { bg: 'rgba(217,119,6,.1)', border: 'rgba(217,119,6,.25)', text: '#D97706', bar: '#F59E0B' },
  S: { bg: 'rgba(220,38,38,.1)', border: 'rgba(220,38,38,.25)', text: '#DC2626', bar: '#EF4444' },
  B: { bg: 'rgba(14,165,233,.1)', border: 'rgba(14,165,233,.25)', text: '#0284C7', bar: '#0EA5E9' },
  Zn: { bg: 'rgba(101,163,13,.1)', border: 'rgba(101,163,13,.25)', text: '#4D7C0F', bar: '#65A30D' },
};
const STEPS_META = [
  { n: 1, label: 'Información', icon: Leaf },
  { n: 2, label: 'Análisis y Diagnóstico', icon: Beaker },
  { n: 3, label: 'Fuentes Fertilizantes', icon: FlaskConical },
  { n: 4, label: 'Recomendación', icon: BarChart2 },
];
const NUTRIENTS = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S'];

/** Selector de unidades de presentación (§16) — solo visual; unidad canónica kg/ha. */
const UNIT_OPTIONS = [
  { id: 'kg_ha',           label: 'kg/ha' },
  { id: 'kg_totales',      label: 'kg totales' },
  { id: 'bultos_totales',  label: 'bultos totales' },
  { id: 'bultos_ha',       label: 'bultos/ha' },
  { id: 'g_planta',        label: 'g/planta' },
  { id: 'kg_planta',       label: 'kg/planta' },
];

function formatNum(v, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: decimals });
}

/** Conversión display-only de la dosis según la unidad seleccionada (§16-§18). */
function doseInUnit(product, unit) {
  switch (unit) {
    case 'kg_totales':     return product.total_kg;
    case 'bultos_totales': return product.total_packages;
    case 'bultos_ha':      return product.packages_per_ha;
    case 'g_planta':       return product.dose_g_plant;
    case 'kg_planta':      return product.dose_kg_plant;
    case 'kg_ha':
    default:               return product.actual_dose_kg_ha ?? product.calculated_dose_kg_ha;
  }
}

/* ── helpers de estilo ────────────────────────────────────────────── */
const card = {
  background: 'var(--fert-card,var(--bg-card))',
  borderRadius: '16px',
  border: '1px solid var(--fert-border,var(--border-color))',
  padding: '24px',
  boxShadow: 'var(--fert-shadow,var(--card-shadow))',
};
const lbl = { fontSize: '11px', fontWeight: '600', letterSpacing: '.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' };
const inp = (err) => ({ width: '100%', padding: '10px 12px', background: 'var(--bg-input,var(--bg-card))', border: `1px solid ${err ? '#EF4444' : 'var(--border-color)'}`, borderRadius: '10px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' });
const sel = (err) => ({ ...inp(err), cursor: 'pointer' });
const errT = { fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' };
const fg = { display: 'flex', flexDirection: 'column', gap: '6px' };
const sec = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' };

/* ══ Stepper ══════════════════════════════════════════════════════ */
function StepperHeader({ step, goToStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '24px', padding: '20px 28px', background: 'var(--fert-card)', borderRadius: '16px', border: '1px solid var(--fert-border)' }}>
      {STEPS_META.map((s, i) => {
        const done = step > s.n, active = step === s.n, Icon = s.icon;
        return (
          <Fragment key={s.n}>
            <button onClick={() => done && goToStep(s.n)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: done ? 'pointer' : 'default', padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#059669' : active ? 'var(--primary)' : 'var(--border-color)', color: done || active ? '#fff' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '700', flexShrink: 0, transition: 'all .2s' }}>
                {done ? <CheckCircle size={16} /> : <Icon size={15} />}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '500', letterSpacing: '.05em', textTransform: 'uppercase' }}>Paso {s.n}</div>
                <div style={{ fontSize: '13px', fontWeight: active ? '700' : '500', color: active ? 'var(--primary)' : done ? '#059669' : 'var(--text-secondary)' }}>{s.label}</div>
              </div>
            </button>
            {i < STEPS_META.length - 1 && (
              <div style={{ flex: 1, height: '2px', margin: '0 8px', background: step > s.n ? '#059669' : 'var(--border-color)', transition: 'background .3s', borderRadius: '1px' }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/* ══ PASO 1 ════════════════════════════════════════════════════════ */
function Step1({ calc }) {
  const { form, errors, lotes, crops, stages, updateField, updateSoil, selectLote, selectCrop } = calc;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: '20px', alignItems: 'start' }}>

      {/* Info del Lote */}
      <div style={card}>
        <div style={sec}><Leaf size={16} color="var(--primary)" /><span>Información del Lote</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={fg}>
            <label style={lbl}>Lote / Sector</label>
            <select style={sel()} value={form.lotId} onChange={e => selectLote(e.target.value)}>
              <option value="">Seleccionar lote</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div style={fg}>
            <label style={lbl}>Cultivo <span style={{ color: '#EF4444' }}>*</span></label>
            <select style={sel(errors.cropId)} value={form.cropId} onChange={e => selectCrop(e.target.value)}>
              <option value="">Seleccionar cultivo</option>
              {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.cropId && <span style={errT}>{errors.cropId}</span>}
          </div>
          <div style={fg}>
            <label style={lbl}>Variedad</label>
            <input style={inp()} placeholder="Ingresa la variedad" value={form.variedad} onChange={e => updateField('variedad', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fg}>
              <label style={lbl}>Área del lote (ha)</label>
              <input style={inp()} type="number" min="0" step=".01" placeholder="0.00" value={form.areaHa || ''} onChange={e => updateField('areaHa', e.target.value)} />
            </div>
            <div style={fg}>
              <label style={lbl}>Etapa fenológica <span style={{ color: '#EF4444' }}>*</span></label>
              <select style={sel(errors.stageId)} value={form.stageId} onChange={e => {
                const s = stages.find(x => x.id === e.target.value);
                updateField('stageId', e.target.value);
                updateField('stageName', s?.name || '');
              }}>
                <option value="">Seleccionar etapa</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {errors.stageId && <span style={errT}>{errors.stageId}</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fg}>
              <label style={lbl}>Fecha de siembra</label>
              <input style={inp()} type="date" value={form.fechaSiembra} onChange={e => updateField('fechaSiembra', e.target.value)} />
            </div>
            <div style={fg}>
              <label style={lbl}>Sistema de producción</label>
              <select style={sel()} value={form.sistemaProductivo} onChange={e => updateField('sistemaProductivo', e.target.value)}>
                <option value="convencional">Convencional</option>
                <option value="organico">Orgánico Certificado</option>
                <option value="semiorganico">Semi-orgánico</option>
                <option value="agroecologico">Agroecológico</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Análisis de Suelo */}
      <div style={card}>
        <div style={sec}><FlaskConical size={16} color="#7C3AED" /><span>Información del Análisis de Suelo</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { field: 'pH', label: 'pH', ph: '6.0 – 7.5' },
              { field: 'organicMatter', label: 'Materia Orgánica (%)', ph: '3.5' },
              { field: 'N', label: 'N (ppm)', ph: '15' },
              { field: 'P', label: 'P (ppm)', ph: '20' },
              { field: 'K', label: 'K (cmol+/kg)', ph: '0.30' },
              { field: 'Ca', label: 'Ca (cmol+/kg)', ph: '5.0' },
              { field: 'Mg', label: 'Mg (cmol+/kg)', ph: '1.5' },
              { field: 'S', label: 'S (ppm)', ph: '12' },
            ].map(({ field, label, ph }) => (
              <div key={field} style={fg}>
                <label style={lbl}>{label}</label>
                <input style={inp()} type="number" step=".01" placeholder={ph} value={form.soil[field]} onChange={e => updateSoil(field, e.target.value)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fg}>
              <label style={lbl}>Fecha del análisis</label>
              <input style={inp()} type="date" value={form.fechaAnalisis} onChange={e => updateField('fechaAnalisis', e.target.value)} />
            </div>
            <div style={fg}>
              <label style={lbl}>Laboratorio</label>
              <input style={inp()} placeholder="Nombre del lab" value={form.laboratorio} onChange={e => updateField('laboratorio', e.target.value)} />
            </div>
          </div>
          <div style={fg}>
            <label style={lbl}>Profundidad de muestreo</label>
            <select style={sel()} value={form.profundidadMuestreo} onChange={e => updateField('profundidadMuestreo', e.target.value)}>
              <option value="0-20">0 – 20 cm</option>
              <option value="0-30">0 – 30 cm</option>
              <option value="20-40">20 – 40 cm</option>
              <option value="0-40">0 – 40 cm</option>
            </select>
          </div>
        </div>
      </div>

      {/* Objetivo + Notas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={card}>
          <div style={sec}><Sparkles size={16} color="#D97706" /><span>Objetivo de Producción</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={fg}>
              <label style={lbl}>Meta de rendimiento (t/ha) <span style={{ color: '#EF4444' }}>*</span></label>
              <input style={inp(errors.targetYieldTHa)} type="number" min="0" step=".1" placeholder="0" value={form.targetYieldTHa} onChange={e => updateField('targetYieldTHa', e.target.value)} />
              {errors.targetYieldTHa && <span style={errT}>{errors.targetYieldTHa}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fg}>
                <label style={lbl}>Plantas por hectárea</label>
                <input style={inp()} type="number" min="0" step="1" placeholder="Ej: 4000" value={form.plantsHa} onChange={e => updateField('plantsHa', e.target.value)} />
              </div>
              <div style={fg}>
                <label style={lbl}>Método de aplicación</label>
                <select style={sel()} value={form.applicationMethod} onChange={e => updateField('applicationMethod', e.target.value)}>
                  <option value="granular">Granular (voleo)</option>
                  <option value="liquid">Fertirriego / Líquido</option>
                  <option value="foliar">Foliar</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ ...lbl, margin: 0, flex: 1 }}>Remover rendimiento anterior</label>
              <button onClick={() => updateField('removeResidues', !form.removeResidues)}
                style={{ width: '42px', height: '22px', borderRadius: '11px', background: form.removeResidues ? 'var(--primary)' : 'var(--border-color)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all .2s' }}>
                <span style={{ position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left .2s', left: form.removeResidues ? '22px' : '2px' }} />
              </button>
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={sec}><Info size={16} color="var(--text-secondary)" /><span>Notas Adicionales</span></div>
          <textarea placeholder="Ingresa observaciones o notas (opcional)" value={form.notes} onChange={e => updateField('notes', e.target.value)}
            style={{ width: '100%', minHeight: '90px', padding: '10px 12px', background: 'var(--bg-input,var(--bg-card))', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Leaf size={16} color="#059669" style={{ marginTop: '1px', flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Tip: Completa toda la información para obtener una recomendación más precisa y ajustada a tu cultivo.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══ PASO 2 ════════════════════════════════════════════════════════ */
function Step2({ calc }) {
  const { form, updateField, updateSoil } = calc;
  const pHNum = parseFloat(form.soil.pH);
  const phClass = isNaN(pHNum) ? null : pHNum < 5.5 ? { l: 'Fuertemente Ácido', c: '#EF4444' }
    : pHNum < 6 ? { l: 'Moderadamente Ácido', c: '#F59E0B' }
      : pHNum < 6.5 ? { l: 'Ligeramente Ácido', c: '#D97706' }
        : pHNum < 7 ? { l: 'Neutro', c: '#059669' }
          : { l: 'Ligeramente Alcalino', c: '#3B82F6' };
  const omNum = parseFloat(form.soil.organicMatter);
  const omClass = isNaN(omNum) ? null : omNum < 2 ? { l: 'Bajo', c: '#EF4444' } : omNum < 4 ? { l: 'Medio', c: '#F59E0B' } : { l: 'Alto', c: '#059669' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div style={card}>
        <div style={sec}><Beaker size={16} color="#7C3AED" /><span>Parámetros del Suelo</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={fg}>
            <label style={lbl}>pH del suelo</label>
            <input style={inp()} type="number" step=".1" min="3" max="10" placeholder="6.5" value={form.soil.pH} onChange={e => updateSoil('pH', e.target.value)} />
            {phClass && <span style={{ fontSize: '11px', color: phClass.c, fontWeight: '600' }}>{phClass.l}</span>}
          </div>
          <div style={fg}>
            <label style={lbl}>Materia Orgánica (%)</label>
            <input style={inp()} type="number" step=".1" placeholder="3.5" value={form.soil.organicMatter} onChange={e => updateSoil('organicMatter', e.target.value)} />
            {omClass && <span style={{ fontSize: '11px', color: omClass.c, fontWeight: '600' }}>{omClass.l}</span>}
          </div>
          {[{ f: 'N', l: 'N (ppm)', ph: '15' }, { f: 'P', l: 'P (ppm)', ph: '20' }, { f: 'K', l: 'K (cmol+/kg)', ph: '0.30' }, { f: 'Ca', l: 'Ca (cmol+/kg)', ph: '5.0' }, { f: 'Mg', l: 'Mg (cmol+/kg)', ph: '1.5' }, { f: 'S', l: 'S (ppm)', ph: '12' }].map(({ f, l, ph }) => (
            <div key={f} style={fg}>
              <label style={lbl}>{l}</label>
              <input style={inp()} type="number" step=".01" placeholder={ph} value={form.soil[f]} onChange={e => updateSoil(f, e.target.value)} />
            </div>
          ))}
          <div style={fg}>
            <label style={lbl}>Textura</label>
            <select style={sel()} value={form.soil.texture} onChange={e => updateSoil('texture', e.target.value)}>
              <option value="arenoso">Arenoso</option>
              <option value="franco_arenoso">Franco-Arenoso</option>
              <option value="franco">Franco</option>
              <option value="franco_arcilloso">Franco-Arcilloso</option>
              <option value="arcilloso">Arcilloso</option>
            </select>
          </div>
          <div style={fg}>
            <label style={lbl}>CIC (cmol+/kg)</label>
            <input style={inp()} type="number" step=".1" placeholder="20" value={form.soil.cec} onChange={e => updateSoil('cec', e.target.value)} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={card}>
          <div style={sec}><BarChart2 size={16} color="#D97706" /><span>Diagnóstico Visual Preliminar</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {NUTRIENTS.map(n => {
              const rawKey = n === 'P2O5' ? 'P' : n === 'K2O' ? 'K' : n;
              const raw = form.soil[rawKey];
              const val = parseFloat(raw);
              const hasVal = !isNaN(val) && raw !== '';
              const MAX_VIS = { N: 50, P: 60, K: 0.6, Ca: 10, Mg: 3, S: 40 };
              const pct = hasVal ? Math.min(100, (val / (MAX_VIS[rawKey] || 50)) * 100) : 0;
              const col = NCOL[n];
              return (
                <div key={n}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>{NUTRIENT_LABELS[n]}</span>
                    <span style={{ fontSize: '12px', color: col.text, fontWeight: '600' }}>{hasVal ? val : '--'}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: col.bar, borderRadius: '3px', transition: 'width .4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={card}>
          <div style={sec}><Calculator size={16} color="var(--primary)" /><span>Metodología de Cálculo</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'extraction', l: 'Extracción por rendimiento', d: 'Basada en kg de nutrientes extraídos por tonelada de producción.', rec: true },
              { id: 'stage_fixed', l: 'Dosis fija por etapa', d: 'Aplica dosis predeterminadas según la etapa fenológica.' },
              { id: 'balance', l: 'Balance nutricional', d: 'Considera entradas y salidas de nutrientes en el sistema.' },
            ].map(({ id, l, d, rec }) => (
              <button key={id} onClick={() => updateField('methodology', id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: `2px solid ${(form.methodology || 'extraction') === id ? 'var(--primary)' : 'var(--border-color)'}`, background: (form.methodology || 'extraction') === id ? 'rgba(5,150,105,.06)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2, border: '2px solid var(--primary)', background: (form.methodology || 'extraction') === id ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(form.methodology || 'extraction') === id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {l}{rec && <span style={{ fontSize: '10px', background: 'rgba(5,150,105,.12)', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>Recomendado</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{d}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══ PASO 4 — Recomendación (resultado del motor) ══════════════════ */
function StatusBadge({ status }) {
  const map = {
    adequate:    { l: 'Adecuado',         bg: 'rgba(5,150,105,.12)',  c: '#059669' },
    deficit:     { l: 'Déficit',          bg: 'rgba(239,68,68,.12)',  c: '#EF4444' },
    excess:      { l: 'Sobreaplicación',  bg: 'rgba(245,158,11,.14)', c: '#D97706' },
    no_requirement: null,
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.c }}>
      {cfg.l}
    </span>
  );
}

function Step4Recommendation({ calc }) {
  const { result, form, displayUnit, setDisplayUnit } = calc;

  if (!result) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
        <ClipboardList size={40} style={{ opacity: .4 }} />
        <div style={{ marginTop: '12px', fontSize: '15px' }}>Calcula primero para ver la recomendación</div>
      </div>
    );
  }

  // ── NO SOLUTION: el motor nunca fuerza una formulación (§11) ──
  if (result.status === 'no_solution') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...card, borderColor: 'rgba(239,68,68,.35)', background: 'rgba(239,68,68,.04)' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <XCircle size={26} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#EF4444' }}>
                No existe una combinación factible con los fertilizantes seleccionados
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Los fertilizantes registrados no cubren todos los requerimientos nutricionales del diagnóstico.
                Regresa al Paso 3 y agrega fuentes para los nutrientes indicados.
              </div>
              {!!result.uncovered_nutrients?.length && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {result.uncovered_nutrients.map(n => (
                    <span key={n} style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', background: 'rgba(239,68,68,.12)', color: '#EF4444' }}>
                      {NUTRIENT_LABELS[n] || n} → sin fuente disponible
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {(result.warnings || []).map((w, i) => (
          <WarningRow key={i} message={w} />
        ))}
      </div>
    );
  }

  const areaHa = result.lot_context?.area_ha ?? parseFloat(form.areaHa) ?? null;
  const plantsHa = result.lot_context?.plants_per_ha ?? null;
  const balanceEntries = Object.entries(result.nutrient_balance || {});
  const maxRequired = Math.max(...balanceEntries.map(([, b]) => Math.max(b.required, b.supplied)), 1);
  const coverages = balanceEntries.map(([, b]) => b.coverage).filter((v) => v !== null);
  const minCoverage = coverages.length ? Math.min(...coverages) : null;
  const doses = result.products || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado + KPIs */}
      <div style={{ ...card, background: 'linear-gradient(135deg,rgba(5,150,105,.08) 0%,rgba(5,150,105,.02) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {result.crop?.name || form.cropName} — {result.phenological_stage?.name || form.stageName}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Meta: {result.target_yield_t_ha ?? form.targetYieldTHa} t/ha · Área: {formatNum(areaHa, 2)} ha
              {plantsHa ? <> · Densidad: {formatNum(plantsHa, 0)} plantas/ha</> : null}
              · Método: {form.applicationMethod}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}><Save size={14} /> Guardar</button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', background: 'var(--primary)', cursor: 'pointer', fontSize: '13px', color: '#fff', fontWeight: '600' }}><Download size={14} /> Exportar PDF</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '16px' }}>
          {[
            { label: 'Productos', value: doses.length, unit: 'fuentes', color: '#7C3AED' },
            { label: 'Dosis total', unit: 'kg/ha', color: 'var(--primary)',
              value: formatNum(doses.reduce((s, p) => s + (p.actual_dose_kg_ha || 0), 0), 1) },
            { label: 'Total predio', unit: 'kg', color: '#D97706',
              value: areaHa ? formatNum(doses.reduce((s, p) => s + (p.total_kg || 0), 0), 0) : '—' },
            { label: 'Costo estimado', unit: result.currency || '', color: '#059669',
              value: result.total_cost !== null && result.total_cost !== undefined ? `$${formatNum(result.total_cost, 2)}` : '—' },
            { label: 'Cobertura mínima', unit: '% requerimiento', color: minCoverage !== null && minCoverage >= 95 ? '#059669' : '#DC2626',
              value: minCoverage !== null ? `${formatNum(minCoverage, 1)}%` : '—' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ background: 'var(--fert-card)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color, marginTop: '4px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selector de unidades de recomendación (§16) */}
      <div style={{ ...card, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Unidad de recomendación
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {UNIT_OPTIONS.map(u => (
              <button key={u.id} onClick={() => setDisplayUnit(u.id)}
                style={{
                  padding: '6px 12px', borderRadius: '18px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  border: `1px solid ${displayUnit === u.id ? 'var(--primary)' : 'var(--border-color)'}`,
                  background: displayUnit === u.id ? 'rgba(5,150,105,.1)' : 'transparent',
                  color: displayUnit === u.id ? 'var(--primary)' : 'var(--text-secondary)',
                }}>
                {u.label}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Unidad interna del motor: kg/ha
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Receta por producto */}
        <div style={card}>
          <div style={sec}><FlaskConical size={16} color="#7C3AED" /><span>Dosis Recomendadas</span></div>
          {!doses.length ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px 0' }}>
              <FlaskConical size={32} style={{ opacity: .3 }} />
              <div style={{ fontSize: '13px', marginTop: '8px' }}>El diagnóstico no requiere aporte de fertilizante.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Producto', UNIT_OPTIONS.find(u => u.id === displayUnit)?.label || 'kg/ha', 'kg/ha real', areaHa ? `Total (${formatNum(areaHa, 2)} ha)` : 'Total', 'Bultos', 'g/planta', 'Costo'].map(h => (
                      <th key={h} style={{ padding: '10px 10px', textAlign: h === 'Producto' ? 'left' : 'right', fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doses.map(p => (
                    <tr key={p.product_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {Object.entries(p.composition || {}).filter(([, v]) => v > 0).map(([nut, pct]) => (
                            <span key={nut} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '6px', background: (NCOL[nut] || NCOL.N).bg, color: (NCOL[nut] || NCOL.N).text, fontWeight: '600' }}>
                              {nut} {pct}%
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {formatNum(doseInUnit(p, displayUnit), 2)}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatNum(p.actual_dose_kg_ha, 1)}
                        {p.total_packages != null && p.actual_dose_kg_ha !== p.calculated_dose_kg_ha && (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            calc: {formatNum(p.calculated_dose_kg_ha, 1)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {areaHa ? formatNum(p.total_kg, 0) : '—'}
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>kg</div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {p.total_packages != null ? formatNum(p.total_packages, 0) : '—'}
                        {p.presentation_kg != null && (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{formatNum(p.presentation_kg, 0)} kg/bulto</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.dose_g_plant != null ? formatNum(p.dose_g_plant, 1) : '—'}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.cost != null ? `$${formatNum(p.cost, 2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Balance nutricional final (§20-§21) */}
        <div style={card}>
          <div style={sec}><BarChart2 size={16} color="var(--primary)" /><span>Aporte Real vs Requerimiento</span></div>
          {!balanceEntries.length ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
              Sin balance disponible.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {balanceEntries.map(([nutrient, b]) => {
                const col = NCOL[nutrient] || NCOL.N;
                const reqPct = maxRequired > 0 ? Math.min(100, (b.required / maxRequired) * 100) : 0;
                const supPct = maxRequired > 0 ? Math.min(100, (b.supplied / maxRequired) * 100) : 0;
                return (
                  <div key={nutrient}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {NUTRIENT_LABELS[nutrient] || nutrient}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatNum(b.supplied, 1)} / {formatNum(b.required, 1)} kg/ha
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: col.text }}>
                          {b.coverage !== null ? `${formatNum(b.coverage, 1)}%` : '—'}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--border-color)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${reqPct}%`, background: 'rgba(148,163,184,.45)', borderRadius: '4px' }} />
                      <div style={{
                        height: '100%', position: 'absolute', top: 0,
                        width: `${supPct}%`,
                        background: b.status === 'deficit' ? '#EF4444' : b.status === 'excess' ? '#F59E0B' : col.bar,
                        borderRadius: '4px', opacity: .85, transition: 'width .6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(148,163,184,.45)', borderRadius: 2, marginRight: 4 }} />Requerimiento neto</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2, marginRight: 4 }} />Aporte real (post-bultos)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {(result.warnings || []).map((w, i) => <WarningRow key={i} message={w} />)}

      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
        Motor v{result.engine_version || '?'} · cálculo {result.calculation_version || ''} · snapshot generado {result.calculated_at ? new Date(result.calculated_at).toLocaleString('es') : ''}
      </div>
    </div>
  );
}

function WarningRow({ message }) {
  if (!message) return null;
  return (
    <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', gap: '10px', alignItems: 'center' }}>
      <AlertTriangle size={15} color="#D97706" />
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{message}</span>
    </div>
  );
}

/* ══ CalculadoraPage — orquestador ══════════════════════════════════ */
export default function CalculadoraPage({ companyId }) {
  const calc = useCalculadora(companyId);
  const { step, calculating, calcError, result, sourcesValid, goNext, goPrev, calculate, reset, goToStep } = calc;
  const renderStep = () => {
    switch (step) {
      case 1: return <Step1 calc={calc} />;
      case 2: return <Step2 calc={calc} />;
      case 3: return <Step3Sources calc={calc} />;
      case 4: return <Step4Recommendation calc={calc} />;
      default: return null;
    }
  };

  const canCalculate = !calculating && Boolean(sourcesValid?.());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <StepperHeader step={step} goToStep={goToStep} />
      <div style={{ minHeight: '480px' }}>{renderStep()}</div>

      {step === 3 && calculating && (
        <div style={{ ...card, marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', gap: '16px' }}>
          <Loader2 size={26} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Formulando recomendación…</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              El motor está resolviendo la combinación y dosis óptimas con tus fuentes fertilizantes.
            </div>
          </div>
        </div>
      )}

      {calcError && step === 3 && (
        <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{calcError}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0', marginTop: '20px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {step > 1 && (
            <button onClick={goPrev} disabled={calculating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
              <ChevronLeft size={16} /> Anterior
            </button>
          )}
          <button onClick={reset} disabled={calculating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <RotateCcw size={15} /> Reiniciar
          </button>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {step < 3 && (
            <button onClick={goNext} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
              Siguiente <ChevronRight size={16} />
            </button>
          )}
          {step === 3 && (
            <>
              <button onClick={calculate} disabled={!canCalculate}
                title={canCalculate ? 'Ejecutar el motor de formulación' : 'Registra fuentes válidas para calcular'}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '12px', border: 'none', background: canCalculate ? 'var(--primary)' : 'var(--border-color)', cursor: canCalculate ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '700', color: '#fff', transition: 'all .2s ease' }}>
                {calculating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Calculator size={16} />}
                {calculating ? 'Calculando…' : 'Calcular Recomendación'}
              </button>
              {result && !calculating && (
                <button onClick={() => goToStep(4)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(5,150,105,.06)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--primary)' }}>
                  Ver Recomendación <ArrowRight size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
