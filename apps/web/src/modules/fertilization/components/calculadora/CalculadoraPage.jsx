/**
 * CalculadoraPage.jsx — REFACTORIZADO §1-§16
 * Flujo agronómico correcto:
 *   1. Información y análisis de suelo  → ¿Qué tenemos en el lote?
 *   2. Requerimientos nutricionales     → ¿Qué necesita el cultivo?
 *   3. Balance y recomendación          → ¿Qué falta y cómo lo suministramos?
 *   4. Resumen                          → ¿Qué vamos a aplicar exactamente?
 *
 * Separación: datos de diagnóstico (Paso1) vs conocimiento agronómico (Paso2) vs motor de decisión (Paso3/4)
 * El frontend nunca calcula la recomendación: captura parámetros y muestra resultados del motor determinístico.
 */
import { Fragment, useEffect } from 'react';
import {
  Leaf, ChevronRight, ChevronLeft, Calculator, Save,
  CheckCircle, AlertTriangle, Info, FlaskConical,
  Beaker, BarChart2, ClipboardList, Loader2, RotateCcw,
  ArrowRight, Sparkles, Download, XCircle,
  ArrowLeft,
} from 'lucide-react';
import { useCalculadora } from '../../hooks/useCalculadora.js';
import Step2Requirements from './Step2Requirements.jsx';
import Step3BalanceAndSources from './Step3BalanceAndSources.jsx';

const NUTRIENT_LABELS = {
  N: 'Nitrógeno (N)', P2O5: 'Fósforo (P₂O₅)', K2O: 'Potasio (K₂O)',
  Ca: 'Calcio (Ca)', Mg: 'Magnesio (Mg)', S: 'Azufre (S)',
  B: 'Boro (B)', Zn: 'Zinc (Zn)', Fe: 'Hierro (Fe)', Mn: 'Manganeso (Mn)', Cu: 'Cobre (Cu)',
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
  Fe: { bg: 'rgba(120,53,15,.1)', text: '#78350F', bar: '#A16207' },
  Mn: { bg: 'rgba(13,148,136,.1)', text: '#0D9488', bar: '#14B8A6' },
  Cu: { bg: 'rgba(185,28,28,.1)', text: '#B91C1C', bar: '#DC2626' },
};
const STEPS_META = [
  { n: 1, label: 'Información y análisis de suelo', short: 'Información', icon: Leaf },
  { n: 2, label: 'Requerimientos nutricionales', short: 'Requerimientos', icon: Beaker },
  { n: 3, label: 'Balance y recomendación', short: 'Balance', icon: FlaskConical },
  { n: 4, label: 'Resumen', short: 'Resumen', icon: BarChart2 },
];
const NUTRIENTS = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S'];
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

function StepperHeader({ step, goToStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '24px', padding: '20px 28px', background: 'var(--fert-card)', borderRadius: '16px', border: '1px solid var(--fert-border)' }}>
      {STEPS_META.map((s, i) => {
        const done = step > s.n, active = step === s.n, Icon = s.icon;
        return (
          <Fragment key={s.n}>
            <button onClick={() => done && goToStep(s.n)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: done ? 'pointer' : 'default', padding: '4px 8px', borderRadius: '8px', flexShrink: 0, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#059669' : active ? 'var(--primary)' : 'var(--border-color)', color: done || active ? '#fff' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '700', flexShrink: 0, transition: 'all .2s' }}>
                {done ? <CheckCircle size={16} /> : <Icon size={15} />}
              </div>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '500', letterSpacing: '.05em', textTransform: 'uppercase' }}>Paso {s.n}</div>
                <div style={{ fontSize: '13px', fontWeight: active ? '700' : '500', color: active ? 'var(--primary)' : done ? '#059669' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.label}>{s.short || s.label}</div>
              </div>
            </button>
            {i < STEPS_META.length - 1 && (
              <div style={{ flex: 1, height: '2px', margin: '0 8px', background: step > s.n ? '#059669' : 'var(--border-color)', transition: 'background .3s', borderRadius: '1px', minWidth: '12px' }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/* ── PASO 1 — Información y análisis de suelo (sin cambios funcionales, solo clarifica que no calcula aún) ── */
function Step1({ calc }) {
  const { form, errors, lotes, crops, stages, updateField, updateSoil, selectLote, selectCrop } = calc;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: '20px', alignItems: 'start' }}>
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
            <input style={inp()} placeholder="Ingresa la variedad (ej: CCN-51)" value={form.variedad} onChange={e => updateField('variedad', e.target.value)} />
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

      <div style={card}>
        <div style={sec}><FlaskConical size={16} color="#7C3AED" /><span>Información del Análisis de Suelo</span></div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
          Describe las condiciones reales del lote. No calcula aún la fórmula. El aporte se estimará con conversión agronómica en el Paso 3.
        </div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={card}>
          <div style={sec}><Sparkles size={16} color="#D97706" /><span>Objetivo de Producción</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={fg}>
              <label style={lbl}>Meta de rendimiento (t/ha) <span style={{ color: '#EF4444' }}>*</span></label>
              <input style={inp(errors.targetYieldTHa)} type="number" min="0" step=".1" placeholder="0" value={form.targetYieldTHa} onChange={e => updateField('targetYieldTHa', e.target.value)} />
              {errors.targetYieldTHa && <span style={errT}>{errors.targetYieldTHa}</span>}
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Usado en Paso 2 para escalar requerimiento por extracción.</span>
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
          </div>
        </div>
        <div style={card}>
          <div style={sec}><Info size={16} color="var(--text-secondary)" /><span>Notas Adicionales</span></div>
          <textarea placeholder="Observaciones del lote (opcional)" value={form.notes} onChange={e => updateField('notes', e.target.value)}
            style={{ width: '100%', minHeight: '90px', padding: '10px 12px', background: 'var(--bg-input,var(--bg-card))', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Leaf size={16} color="#059669" style={{ marginTop: '1px', flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Paso 1 registra <strong>qué tenemos</strong>. El Paso 2 definirá <strong>qué necesita el cultivo</strong> según cultivo + etapa + meta.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Paso 4 — Resumen/Recomendación (resultado del motor) ── */
function StatusBadge({ status }) {
  const map = {
    adequate:    { l: 'Adecuado',         bg: 'rgba(5,150,105,.12)',  c: '#059669' },
    deficit:     { l: 'Déficit',          bg: 'rgba(239,68,68,.12)',  c: '#EF4444' },
    excess:      { l: 'Sobreaplicación',  bg: 'rgba(245,158,11,.14)', c: '#D97706' },
    covered:     { l: 'Cubierto',         bg: 'rgba(5,150,105,.12)',  c: '#059669' },
    no_requirement: null,
  };
  const cfg = map[status];
  if (!cfg) return null;
  return <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.c }}>{cfg.l}</span>;
}

function Step4Recommendation({ calc }) {
  const { result, form, displayUnit, setDisplayUnit } = calc;
  if (!result) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
        <ClipboardList size={40} style={{ opacity: .4 }} />
        <div style={{ marginTop: '12px', fontSize: '15px' }}>Calcula primero para ver la recomendación</div>
        <div style={{ fontSize: '12px', marginTop: '6px' }}>El motor calculará Déficit = Demanda (Paso 2) − Oferta estimada del suelo (Paso 1) y optimizará la combinación de fertilizantes.</div>
      </div>
    );
  }
  if (result.status === 'no_solution') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...card, borderColor: 'rgba(239,68,68,.35)', background: 'rgba(239,68,68,.04)' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <XCircle size={26} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#EF4444' }}>No existe una combinación factible con los fertilizantes seleccionados</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>Los fertilizantes registrados no cubren todos los requerimientos nutricionales del diagnóstico. Regresa al Paso 3 y agrega fuentes para los nutrientes indicados.</div>
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
        {(result.warnings || []).map((w, i) => <WarningRow key={i} message={w} />)}
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
      <div style={{ ...card, background: 'linear-gradient(135deg,rgba(5,150,105,.08) 0%,rgba(5,150,105,.02) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{result.crop?.name || form.cropName} — {result.phenological_stage?.name || form.stageName}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Meta: {result.target_yield_t_ha ?? form.targetYieldTHa} t/ha · Área: {formatNum(areaHa, 2)} ha{plantsHa ? <> · Densidad: {formatNum(plantsHa, 0)} plantas/ha</> : null} · Método: {form.applicationMethod}
              {form.variedad ? <> · Var: {form.variedad}</> : null} · Sistema: {form.sistemaProductivo}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
              Motor explica: “El cultivo requiere X; el suelo aporta Y; déficit Z; combinación recomendada…” — balance usado: Demanda (Paso 2) − Oferta estimada (Paso 1).
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
            { label: 'Dosis total', unit: 'kg/ha', color: 'var(--primary)', value: formatNum(doses.reduce((s, p) => s + (p.actual_dose_kg_ha || 0), 0), 1) },
            { label: 'Total predio', unit: 'kg', color: '#D97706', value: areaHa ? formatNum(doses.reduce((s, p) => s + (p.total_kg || 0), 0), 0) : '—' },
            { label: 'Costo estimado', unit: result.currency || '', color: '#059669', value: result.total_cost !== null && result.total_cost !== undefined ? `$${formatNum(result.total_cost, 2)}` : '—' },
            { label: 'Cobertura mínima', unit: '% requerimiento', color: minCoverage !== null && minCoverage >= 95 ? '#059669' : '#DC2626', value: minCoverage !== null ? `${formatNum(minCoverage, 1)}%` : '—' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ background: 'var(--fert-card)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color, marginTop: '4px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{unit}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Unidad de recomendación</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {UNIT_OPTIONS.map(u => (
              <button key={u.id} onClick={() => setDisplayUnit(u.id)}
                style={{ padding: '6px 12px', borderRadius: '18px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: `1px solid ${displayUnit === u.id ? 'var(--primary)' : 'var(--border-color)'}`, background: displayUnit === u.id ? 'rgba(5,150,105,.1)' : 'transparent', color: displayUnit === u.id ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {u.label}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>Unidad interna del motor: kg/ha</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        <div style={card}>
          <div style={sec}><FlaskConical size={16} color="#7C3AED" /><span>Dosis Recomendadas — qué vamos a aplicar exactamente</span></div>
          {!doses.length ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px 0' }}><FlaskConical size={32} style={{ opacity: .3 }} /><div style={{ fontSize: '13px', marginTop: '8px' }}>El diagnóstico no requiere aporte de fertilizante.</div></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>{['Producto', UNIT_OPTIONS.find(u => u.id === displayUnit)?.label || 'kg/ha', 'kg/ha real', areaHa ? `Total (${formatNum(areaHa, 2)} ha)` : 'Total', 'Bultos', 'g/planta', 'Costo'].map(h => (
                    <th key={h} style={{ padding: '10px 10px', textAlign: h === 'Producto' ? 'left' : 'right', fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {doses.map(p => (
                    <tr key={p.product_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {Object.entries(p.composition || {}).filter(([, v]) => v > 0).map(([nut, pct]) => (
                            <span key={nut} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '6px', background: (NCOL[nut] || NCOL.N).bg, color: (NCOL[nut] || NCOL.N).text, fontWeight: '600' }}>{nut} {pct}%</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '14px', whiteSpace: 'nowrap' }}>{formatNum(doseInUnit(p, displayUnit), 2)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatNum(p.actual_dose_kg_ha, 1)}{p.total_packages != null && p.actual_dose_kg_ha !== p.calculated_dose_kg_ha && (<div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>calc: {formatNum(p.calculated_dose_kg_ha, 1)}</div>)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{areaHa ? formatNum(p.total_kg, 0) : '—'}<div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>kg</div></td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>{p.total_packages != null ? formatNum(p.total_packages, 0) : '—'}{p.presentation_kg != null && (<div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{formatNum(p.presentation_kg, 0)} kg/bulto</div>)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.dose_g_plant != null ? formatNum(p.dose_g_plant, 1) : '—'}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.cost != null ? `$${formatNum(p.cost, 2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={card}>
          <div style={sec}><BarChart2 size={16} color="var(--primary)" /><span>Aporte Real vs Requerimiento (post-fertilización)</span></div>
          {!balanceEntries.length ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>Sin balance disponible.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {balanceEntries.map(([nutrient, b]) => {
                const col = NCOL[nutrient] || NCOL.N;
                const reqPct = maxRequired > 0 ? Math.min(100, (b.required / maxRequired) * 100) : 0;
                const supPct = maxRequired > 0 ? Math.min(100, (b.supplied / maxRequired) * 100) : 0;
                return (
                  <div key={nutrient}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{NUTRIENT_LABELS[nutrient] || nutrient}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatNum(b.supplied, 1)} / {formatNum(b.required, 1)} kg/ha</span>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: col.text }}>{b.coverage !== null ? `${formatNum(b.coverage, 1)}%` : '—'}</span>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--border-color)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${reqPct}%`, background: 'rgba(148,163,184,.45)', borderRadius: '4px' }} />
                      <div style={{ height: '100%', position: 'absolute', top: 0, width: `${supPct}%`, background: b.status === 'deficit' ? '#EF4444' : b.status === 'excess' ? '#F59E0B' : col.bar, borderRadius: '4px', opacity: .85, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(148,163,184,.45)', borderRadius: 2, marginRight: 4 }} />Requerimiento neto (post-suelo)</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2, marginRight: 4 }} />Aporte real (post-bultos)</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {(result.warnings || []).map((w, i) => <WarningRow key={i} message={w} />)}
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>Motor v{result.engine_version || '?'} · cálculo {result.calculation_version || ''} · snapshot {result.calculated_at ? new Date(result.calculated_at).toLocaleString('es') : ''}</div>
    </div>
  );
}

function WarningRow({ message }) {
  if (!message) return null;
  return <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', gap: '10px', alignItems: 'center' }}><AlertTriangle size={15} color="#D97706" /><span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{message}</span></div>;
}

export default function CalculadoraPage({ companyId }) {
  const calc = useCalculadora(companyId);
  const { step, calculating, calcError, result, goNext, goPrev, calculate, reset, goToStep, form, errors } = calc;
  // Exponer para tests playwright (solo en dev)
  useEffect(() => { if (import.meta.env.DEV && typeof window !== 'undefined') window.__calc = calc; }, [calc]);

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1 calc={calc} />;
      case 2: return <Step2Requirements calc={calc} />;
      case 3: return <Step3BalanceAndSources calc={calc} />;
      case 4: return <Step4Recommendation calc={calc} />;
      default: return null;
    }
  };

  const canCalculate = !calculating && Boolean(calc.sourcesValid?.());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <StepperHeader step={step} goToStep={goToStep} />
      <div style={{ minHeight: '520px' }}>{renderStep()}</div>

      {step !== 3 && step !== 4 && calcError && (
        <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{calcError}</span>
        </div>
      )}
      {errors.requirements && step === 2 && (
        <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: '13px', color: '#991B1B' }}>{errors.requirements}</span>
        </div>
      )}

      {/* Navegación global — Paso 3 maneja su propio botón Calcular; Paso 4 es resumen sin navegación duplicada */}
      {step !== 3 && (
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
              <button onClick={calculate} disabled={!canCalculate} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', borderRadius: '12px', border: 'none', background: !canCalculate ? 'var(--border-color)' : 'var(--primary)', cursor: !canCalculate ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700', color: !canCalculate ? 'var(--text-secondary)' : '#fff' }}>
                <Calculator size={16} /> {calculating ? 'Calculando…' : 'Ver resumen'}
              </button>
            )}
            {step === 4 && (
              <button onClick={() => goToStep(3)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(5,150,105,.06)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--primary)' }}>
                <ArrowLeft size={15} /> Volver a Balance
              </button>
            )}
          </div>
        </div>
      )}
      {step === 3 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0', marginTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={goPrev} disabled={calculating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <button onClick={reset} disabled={calculating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <RotateCcw size={15} /> Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}
