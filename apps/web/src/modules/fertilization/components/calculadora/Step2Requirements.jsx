/**
 * Step2Requirements.jsx
 * PASO 2 — Requerimientos Nutricionales
 *
 * Responde: ¿Cuánto necesita nutricionalmente la planta para alcanzar el objetivo
 * establecido en este lote y en esta etapa fenológica?
 *
 * Arquitectura (§1-§9 del rediseño):
 *   Paso 1 = Qué tenemos en el lote (suelo + lote)
 *   Paso 2 = Qué necesita el cultivo (demanda nutricional) ← este compomente
 *   Paso 3 = Qué falta y cómo lo suministramos (Balance = Demanda - Oferta)
 *   Paso 4 = Qué vamos a aplicar exactamente (dosis)
 *
 * Distingue Fuente del requerimiento:
 *   • Base de datos SkyCrop  → cultivo + etapa + meta productiva + sistema + variedad
 *   • Requerimiento personalizado → técnico edita manualmente
 *   • Extracción por rendimiento → coeff × rendimiento objetivo
 *   • Balance nutricional
 *
 * NO muestra parámetros de suelo (ya capturados en Paso 1).
 * Convierte Paso 2 en editor de requerimientos nutricionales, no en otra pantalla de suelo.
 */
import { useEffect, useMemo, useState } from 'react';
import { Leaf, Plus, Trash2, Info, BookOpen, Calculator, FlaskConical, AlertTriangle } from 'lucide-react';

const NUTRIENT_DEFS = [
  { code: 'N',    label: 'N',      name: 'Nitrógeno',      unit: 'kg/ha', category: 'primary' },
  { code: 'P2O5', label: 'P₂O₅',   name: 'Fósforo',        unit: 'kg/ha', category: 'primary' },
  { code: 'K2O',  label: 'K₂O',    name: 'Potasio',        unit: 'kg/ha', category: 'primary' },
  { code: 'Ca',   label: 'Ca',     name: 'Calcio',         unit: 'kg/ha', category: 'secondary' },
  { code: 'Mg',   label: 'Mg',     name: 'Magnesio',       unit: 'kg/ha', category: 'secondary' },
  { code: 'S',    label: 'S',      name: 'Azufre',         unit: 'kg/ha', category: 'secondary' },
  { code: 'B',    label: 'B',      name: 'Boro',           unit: 'g/ha',  category: 'micro' },
  { code: 'Zn',   label: 'Zn',     name: 'Zinc',           unit: 'g/ha',  category: 'micro' },
  { code: 'Fe',   label: 'Fe',     name: 'Hierro',         unit: 'g/ha',  category: 'micro' },
  { code: 'Mn',   label: 'Mn',     name: 'Manganeso',      unit: 'g/ha',  category: 'micro' },
  { code: 'Cu',   label: 'Cu',     name: 'Cobre',          unit: 'g/ha',  category: 'micro' },
];

const EXTRA_NUTRIENTS = [
  { code: 'Mo', label: 'Mo', name: 'Molibdeno', unit: 'g/ha', category: 'micro' },
  { code: 'Cl', label: 'Cl', name: 'Cloro',     unit: 'g/ha', category: 'micro' },
];

const METHODOLOGIES = [
  { id: 'extraction',   label: 'Extracción por rendimiento', hint: 'kg extraídos por tonelada × rendimiento objetivo', recommended: true },
  { id: 'stage_fixed',  label: 'Dosis fija por etapa',       hint: 'Dosis predeterminadas según etapa fenológica' },
  { id: 'custom',       label: 'Requerimiento personalizado',hint: 'Valores introducidos manualmente por el técnico' },
  { id: 'balance',      label: 'Balance nutricional',        hint: 'Considera entradas/salidas del sistema' },
];

const card = {
  background: 'var(--fert-card,var(--bg-card))',
  borderRadius: '16px',
  border: '1px solid var(--fert-border,var(--border-color))',
  padding: '20px 24px',
  boxShadow: 'var(--fert-shadow,var(--card-shadow))',
};
const lbl = { fontSize: '11px', fontWeight: '700', letterSpacing: '.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' };
const inp = (err) => ({ width: '100%', padding: '10px 12px', background: 'var(--bg-input,var(--bg-card))', border: `1px solid ${err ? '#EF4444' : 'var(--border-color)'}`, borderRadius: '10px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' });
const sec = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' };

function formatNum(v, d = 1) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: d });
}

export default function Step2Requirements({ calc }) {
  const {
    form,
    crops, stages,
    requirementSource, setRequirementSource,
    requirements, distributions, extractionCoeffs,
    updateRequirement, updateDistribution, updateExtractionCoeff,
    addRequirementNutrient, removeRequirementNutrient,
    requirementMeta, updateRequirementMeta,
    loadingRequirements, availableNutrients,
    fetchRequirements, totalRequirementSummary,
  } = calc;

  const cropName = form.cropName || crops.find(c => c.id === form.cropId)?.name || '—';
  const stageName = form.stageName || stages.find(s => s.id === form.stageId)?.name || '—';
  const areaLabel = form.areaHa ? `${formatNum(form.areaHa, 2)} ha` : '—';
  const yieldLabel = form.targetYieldTHa ? `${form.targetYieldTHa} t/ha` : '—';

  const contextualReady = Boolean(form.cropId && form.stageId && form.targetYieldTHa);

  // Nutrientes visibles (los del catálogo + extras añadidos)
  const visibleNutrients = useMemo(() => {
    const codes = new Set(Object.keys(requirements || {}));
    // asegurar que los 6 primarios siempre visibles
    for (const n of NUTRIENT_DEFS) codes.add(n.code);
    const defMap = new Map([...NUTRIENT_DEFS, ...EXTRA_NUTRIENTS].map(n => [n.code, n]));
    return [...codes]
      .map(code => defMap.get(code) || { code, label: code, name: code, unit: 'kg/ha', category: 'micro' })
      .sort((a,b) => {
        const order = ['N','P2O5','K2O','Ca','Mg','S','B','Zn','Fe','Mn','Cu','Mo','Cl'];
        return order.indexOf(a.code) - order.indexOf(b.code);
      });
  }, [requirements]);

  const totalForApp = useMemo(() => {
    let totalKgHa = 0;
    for (const n of visibleNutrients) {
      const raw = requirements?.[n.code];
      const val = parseFloat(raw);
      if (!Number.isFinite(val) || val <= 0) continue;
      const isMicro = n.unit === 'g/ha';
      const kgVal = isMicro ? val / 1000 : val;
      const pct = parseFloat(distributions?.[n.code] ?? 100);
      const factor = Number.isFinite(pct) ? pct / 100 : 1;
      totalKgHa += kgVal * factor;
    }
    return totalKgHa;
  }, [requirements, distributions, visibleNutrients]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Encabezado contextual */}
      <div style={{ ...card, background: 'linear-gradient(135deg,rgba(5,150,105,.08) 0%,rgba(59,130,246,.06) 100%)', borderColor: 'rgba(5,150,105,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: '#059669' }}>Requerimientos nutricionales</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Leaf size={18} color="#059669" />
              {cropName} · {stageName} · {areaLabel} · Meta: {yieldLabel}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '720px', lineHeight: 1.5 }}>
              Defina los requerimientos nutricionales que SkyCrop utilizará para calcular la recomendación de fertilización.
              Estos valores representan la <strong>demanda del cultivo</strong>, condicionada por etapa fenológica y meta productiva — no el análisis de suelo.
            </div>
            {form.variedad && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Variedad: <strong style={{ color: 'var(--text-primary)' }}>{form.variedad}</strong> · Sistema: {form.sistemaProductivo || 'convencional'}</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '20px', background: contextualReady ? 'rgba(5,150,105,.12)' : 'rgba(245,158,11,.12)', color: contextualReady ? '#059669' : '#D97706', fontWeight: '700' }}>
              {contextualReady ? 'Contexto completo' : 'Completa Paso 1'}
            </span>
          </div>
        </div>
      </div>

      {!contextualReady && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} color="#D97706" />
          <span style={{ fontSize: '13px', color: '#92400E' }}>
            Para cargar requerimientos desde la base SkyCrop, completa en el Paso 1: cultivo, etapa fenológica y meta de rendimiento.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '18px', alignItems: 'start' }}>
        {/* Fuente del requerimiento + Metodología */}
        <div style={card}>
          <div style={sec}><Calculator size={16} color="var(--primary)" /><span>Fuente del requerimiento</span></div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
            Seleccione de dónde proviene el requerimiento. SkyCrop nunca almacena solo <em>N = 150 kg/ha</em> aislado: guarda metodología y trazabilidad.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'skycrop_db', label: 'Base de datos SkyCrop', desc: `Requerimiento validado para ${cropName} → ${stageName} → ${yieldLabel}`, disabled: !contextualReady },
              { id: 'extraction', label: 'Requerimiento por extracción', desc: 'Extracción (kg/t) × rendimiento objetivo' },
              { id: 'custom', label: 'Requerimiento personalizado', desc: 'Valores introducidos manualmente por el técnico' },
              { id: 'balance', label: 'Balance nutricional', desc: 'Entradas/salidas del sistema' },
            ].map(opt => {
              const active = requirementSource === opt.id;
              const disabled = opt.disabled;
              return (
                <button
                  key={opt.id}
                  disabled={disabled}
                  onClick={() => !disabled && setRequirementSource(opt.id)}
                  style={{
                    display: 'flex', gap: '12px', alignItems: 'flex-start', textAlign: 'left',
                    padding: '12px 14px', borderRadius: '12px',
                    border: `2px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: active ? 'rgba(5,150,105,.06)' : 'transparent',
                    opacity: disabled ? .5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    border: `2px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: active ? 'var(--primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ ...lbl, marginBottom: '8px' }}>Metodología</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {METHODOLOGIES.map(m => {
                const active = (form.methodology || 'extraction') === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => calc.updateField && calc.updateField('methodology', m.id)}
                    style={{
                      padding: '10px 12px', borderRadius: '10px', textAlign: 'left',
                      border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                      background: active ? 'rgba(5,150,105,.06)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: '700', color: active ? 'var(--primary)' : 'var(--text-primary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {m.label} {m.recommended && <span style={{ fontSize: '9px', background: 'rgba(5,150,105,.12)', color: '#059669', padding: '2px 5px', borderRadius: '4px' }}>Recomendado</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{m.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {requirementSource === 'skycrop_db' && (
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
              <button
                onClick={fetchRequirements}
                disabled={loadingRequirements || !contextualReady}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '10px', border: 'none',
                  background: contextualReady ? 'var(--primary)' : 'var(--border-color)',
                  color: contextualReady ? '#fff' : 'var(--text-secondary)',
                  fontWeight: '700', fontSize: '13px', cursor: contextualReady ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                }}
              >
                <BookOpen size={14} />
                {loadingRequirements ? 'Cargando…' : 'Cargar de SkyCrop DB'}
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', alignSelf: 'center', maxWidth: '180px', lineHeight: 1.4 }}>
                Cultivo + variedad + etapa + sistema + meta productiva
              </span>
            </div>
          )}

          {requirementSource === 'extraction' && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1E40AF', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Info size={13} color="#2563EB" /> Requerimiento por extracción
              </div>
              <div style={{ fontSize: '12px', color: '#1E40AF', marginTop: '6px', lineHeight: 1.5 }}>
                Fórmula: <code style={{ background: 'rgba(255,255,255,.7)', padding: '2px 6px', borderRadius: '4px' }}>Requerimiento = extracción (kg/t) × rendimiento objetivo ({yieldLabel})</code>
                <br />Edite los coeficientes de extracción debajo y SkyCrop calculará el requerimiento total para la meta productiva.
              </div>
            </div>
          )}
        </div>

        {/* Parámetros del requerimiento */}
        <div style={card}>
          <div style={sec}><BookOpen size={16} color="#7C3AED" /><span>Parámetros del requerimiento</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Rendimiento objetivo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    style={{ ...inp(), flex: 1 }}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="5"
                    value={form.targetYieldTHa || ''}
                    onChange={e => calc.updateField && calc.updateField('targetYieldTHa', e.target.value)}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>t/ha</span>
                </div>
              </div>
              <div>
                <label style={lbl}>% a aplicar en esta etapa</label>
                <input
                  style={inp()}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="30"
                  value={requirementMeta?.stagePct || ''}
                  onChange={e => updateRequirementMeta('stagePct', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Eficiencia aprovechamiento (%)</label>
                <input
                  style={inp()}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Ej: 60"
                  value={requirementMeta?.efficiency || ''}
                  onChange={e => updateRequirementMeta('efficiency', e.target.value)}
                />
              </div>
              <div>
                <label style={lbl}>Factor de corrección</label>
                <input
                  style={inp()}
                  type="number"
                  step="0.01"
                  placeholder="1.0"
                  value={requirementMeta?.correctionFactor || ''}
                  onChange={e => updateRequirementMeta('correctionFactor', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Fuente bibliográfica</label>
              <input
                style={inp()}
                placeholder="Ej: FEDECACAO 2023, ICCO Guidelines…"
                value={requirementMeta?.bibliographicSource || ''}
                onChange={e => updateRequirementMeta('bibliographicSource', e.target.value)}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: '8px', marginTop: '8px' }}>
                <input style={inp()} placeholder="Documento / referencia" value={requirementMeta?.sourceDocument || ''} onChange={e => updateRequirementMeta('sourceDocument', e.target.value)} />
                <input style={inp()} placeholder="Año" type="number" value={requirementMeta?.sourceYear || ''} onChange={e => updateRequirementMeta('sourceYear', e.target.value)} />
                <input style={inp()} placeholder="Pág." value={requirementMeta?.sourcePage || ''} onChange={e => updateRequirementMeta('sourcePage', e.target.value)} />
              </div>
            </div>

            <div>
              <label style={lbl}>Observaciones</label>
              <textarea
                placeholder="Metodología, supuestos agronómicos, notas del técnico…"
                value={requirementMeta?.observations || ''}
                onChange={e => updateRequirementMeta('observations', e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-input,var(--bg-card))', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.15)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: '#059669' }}>Requerimiento total vs. aplicación actual:</strong> si el requerimiento anual de K₂O es 240 kg/ha y define 30 % para esta aplicación, SkyCrop derivará 72 kg K₂O/ha. Distingue <em>requerimiento total del ciclo</em> de <em>requerimiento para esta aplicación</em>.
            </div>
          </div>
        </div>
      </div>

      {/* Tabla principal de requerimientos */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={sec}>
            <FlaskConical size={16} color="#059669" />
            <span>Requerimiento nutricional</span>
            <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', marginLeft: '6px' }}>
              {loadingRequirements ? 'Cargando…' : `${visibleNutrients.length} nutrientes`}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Total aplicación actual: <strong style={{ color: 'var(--primary)' }}>{formatNum(totalForApp, 1)} kg/ha</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Nutriente','Unidad','Requerimiento','Extracción (kg/t)','Distribución','Aplicación actual',''].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: h === 'Nutriente' ? 'left' : 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleNutrients.map(n => {
                const val = requirements?.[n.code] ?? '';
                const pct = distributions?.[n.code] ?? '100';
                const ext = extractionCoeffs?.[n.code] ?? '';
                const numVal = parseFloat(val);
                const numPct = parseFloat(pct);
                const isMicro = n.unit === 'g/ha';
                // valor para esta aplicación en unidad mostrada
                let appVal = '—';
                if (Number.isFinite(numVal) && Number.isFinite(numPct)) {
                  const v = numVal * (numPct / 100);
                  appVal = isMicro ? `${formatNum(v,0)}` : formatNum(v,1);
                }
                const distErr = Number.isFinite(numPct) && (numPct < 0 || numPct > 100);
                return (
                  <tr key={n.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: n.category === 'primary' ? '#2563EB' : n.category === 'secondary' ? '#059669' : '#7C3AED',
                          display: 'inline-block', flexShrink: 0
                        }} />
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{n.label}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{n.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {n.unit}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <input
                        style={{ ...inp(), textAlign: 'center', padding: '8px 8px', fontWeight: '600', maxWidth: '110px', margin: '0 auto', display: 'block' }}
                        type="number"
                        step={isMicro ? '10' : '1'}
                        min="0"
                        placeholder="0"
                        value={val}
                        onChange={e => updateRequirement(n.code, e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {requirementSource === 'extraction' ? (
                        <input
                          style={{ ...inp(), textAlign: 'center', padding: '8px 6px', fontSize: '12px', maxWidth: '92px', margin: '0 auto', display: 'block' }}
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="—"
                          value={ext}
                          onChange={e => updateExtractionCoeff(n.code, e.target.value)}
                          title="kg nutriente por tonelada de producto"
                        />
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <input
                          style={{ ...inp(distErr), textAlign: 'center', padding: '8px 6px', width: '66px', fontWeight: '600' }}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={pct}
                          onChange={e => updateDistribution(n.code, e.target.value)}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      {appVal} <span style={{ fontWeight: '400', color: 'var(--text-secondary)', fontSize: '11px' }}>{n.unit}</span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {!['N','P2O5','K2O'].includes(n.code) && (
                        <button
                          onClick={() => removeRequirementNutrient(n.code)}
                          title={`Quitar ${n.code}`}
                          style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {EXTRA_NUTRIENTS.filter(n => !visibleNutrients.some(v => v.code === n.code)).map(n => (
              <button
                key={n.code}
                onClick={() => addRequirementNutrient(n.code)}
                style={{ padding: '6px 10px', borderRadius: '18px', border: '1px dashed var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}
              >
                + {n.label}
              </button>
            ))}
            <button
              onClick={() => {
                const code = window.prompt('Código del nutriente (ej: Si, Na, Cl):');
                if (code && code.trim()) addRequirementNutrient(code.trim());
              }}
              style={{ padding: '6px 10px', borderRadius: '18px', border: '1px dashed var(--primary)', background: 'rgba(5,150,105,.06)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--primary)' }}
            >
              <Plus size={12} style={{ verticalAlign: '-1px' }} /> Agregar nutriente
            </button>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Unidad canónica del motor: kg/ha (micro convertidos internamente)
          </span>
        </div>

        <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.18)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Info size={14} color="#D97706" style={{ marginTop: '1px', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
            SkyCrop distingue <strong>requerimiento total del ciclo</strong> de <strong>requerimiento para esta aplicación</strong> (distribución %). Esto permite generar <em>planes de fertilización</em>, no solo una fórmula aislada.
            {requirementSource === 'custom' && ' — Los valores personalizados quedan auditables con fuente y versión para entrega a clientes.'}
          </span>
        </div>
      </div>
    </div>
  );
}
