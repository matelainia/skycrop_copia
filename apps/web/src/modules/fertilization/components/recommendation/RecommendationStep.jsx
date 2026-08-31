/**
 * RecommendationStep.jsx
 * Orquestador del Paso 3: Recomendación (§4 Bloques A-E).
 * Compone Header + Table + DoseCard + (ContributionTable, Chart, Summary).
 * Respeta Design System SkyCrop (§15-§18) y arquitectura desacoplada (§21).
 */
import { useMemo, useState, useEffect } from 'react';
import { Leaf, Calculator, Save, ArrowRight, ArrowLeft, AlertTriangle, Info, FlaskConical } from 'lucide-react';
import FertilizerRecommendationTable from './FertilizerRecommendationTable.jsx';
import ApplicationDoseCard from './ApplicationDoseCard.jsx';
import NutrientContributionTable from './NutrientContributionTable.jsx';
import FertilizerContributionChart from './FertilizerContributionChart.jsx';
import ApplicationSummary from './ApplicationSummary.jsx';
import { useFertilizationRecommendation } from '../../hooks/useFertilizationRecommendation.js';
import { fertilizationMasterDataApi } from '../../api/fertilization-master-data.api.js';

// Paleta SkyCrop (§15) — vía CSS vars con fallback hex
const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  topBar: { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  header: { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', padding: 20 },
  h1: { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', gap: 10, alignItems: 'center' },
  sub: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 },
  contextGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginTop: 14 },
  ctxCard: { background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 12 },
  ctxLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' },
  ctxValue: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 },
  ctxHint: { fontSize: 11, color: 'var(--text-muted)' },
  methodCard: { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', padding: 18 },
  gridMain: { display: 'grid', gridTemplateColumns: '1.55fr .95fr', gap: 20, alignItems: 'start' },
  // responsive override via inline media handled in CSS file; fallback stack on small screens
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 10 },
};

function formatNum(v, d = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: d });
}

export default function RecommendationStep({
  companyId = null,
  context = {}, // { cultivo, lote, area, metaProductiva, indiceFertilidad, requerimiento } from Paso 1/2
  requirements = null, // Record<code, kg/ha> real del análisis/motor
  initialAreaHa = null,
  initialPlantsPerHa = null,
  onSave = null,
  onNext = null,
  onPrev = null,
}) {
  const areaHa = context.areaHa ?? initialAreaHa ?? '';
  const plantsPerHa = context.plantsPerHa ?? initialPlantsPerHa ?? '';

  const [localArea, setLocalArea] = useState(areaHa);
  const [localPlants, setLocalPlants] = useState(plantsPerHa);
  const [doseMode, setDoseMode] = useState('kg_ha');
  const [doseValue, setDoseValue] = useState('');
  const [calcMethod, setCalcMethod] = useState('garantizado'); // garantizado | laboratorio
  const [notes, setNotes] = useState('');
  const [fertilizerOptions, setFertilizerOptions] = useState([]);
  const [saving, setSaving] = useState(false);

  // derive effective requirements: context.requerimiento nutricional o prop
  const effectiveRequirements = requirements || context.requirements || context.requerimiento || {};

  const rec = useFertilizationRecommendation({
    areaHa: localArea,
    globalPlantsPerHa: localPlants,
    requirements: effectiveRequirements,
  });

  // cargar catálogo real Supabase (productos + fert_calc_fertilizers) — sin mocks
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lotsP = fertilizationMasterDataApi.getLotes ? fertilizationMasterDataApi.getLotes(companyId).catch(() => []) : Promise.resolve([]);
        // intentar fert_calc_fertilizers / productos — fallar silencioso si no existe tabla
        let ferts = [];
        try {
          const { supabase } = await import('../../../../lib/supabaseClient.js');
          const { data } = await supabase.from('fert_calc_fertilizers').select('id,commercial_name,composition').eq('status', 'active').limit(50);
          if (data?.length) ferts = data;
        } catch {}
        if (!cancelled && ferts.length === 0) {
          // fallback a productos con categoría fertilizante
          try {
            const { supabase } = await import('../../../../lib/supabaseClient.js');
            const { data } = await supabase.from('productos').select('id,nombre,formula').ilike('categoria', '%fertil%').limit(50);
            if (data?.length) ferts = data.map((p) => ({ id: p.id, commercial_name: p.nombre, composition: {} }));
          } catch {}
        }
        if (!cancelled) setFertilizerOptions(ferts);
        await lotsP;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // si el usuario usa dosis global, propagar a filas vacías (UX helper, no impone fuente de verdad por fila)
  const applyGlobalDoseToEmpty = () => {
    const v = doseValue;
    const m = doseMode;
    if (v === '' || v === null) return;
    rec.rows.forEach((r) => {
      if (r.doseValue === '' || r.doseValue === null) {
        rec.updateRow(r.id, { doseMode: m, doseValue: String(v) });
      }
    });
  };

  const canCalculate = rec.isValid && rec.rows.some((r) => String(r.doseValue).trim() !== '' && Number(r.doseValue) > 0);

  // presentación promedio para summary
  const presentationAvg = useMemo(() => {
    const vals = rec.rows.map((r) => {
      if (r.presentationKg === 'custom') return Number(r.presentationCustom);
      return Number(r.presentationKg);
    }).filter((n) => Number.isFinite(n) && n > 0);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [rec.rows]);

  const totalsForSummary = useMemo(() => ({
    ...rec.report.totals,
    presentationLabel: presentationAvg ? `${formatNum(presentationAvg, 0)} kg` : '—',
  }), [rec.report.totals, presentationAvg]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try { await onSave({ rows: rec.rows, report: rec.report, notes, calcMethod, context: { areaHa: localArea, plantsPerHa: localPlants, requirements: effectiveRequirements } }); }
    finally { setSaving(false); }
  };

  return (
    <div style={styles.page}>
      {/* Top stepper hint (si no hay stepper global, muestra progreso) */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>3</span>
          Recomendación
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— Define fertilizantes, composición y dosis</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving || !onSave} style={btnOutline} title="Guardar borrador">
            <Save size={14} /> {saving ? 'Guardando…' : 'Guardar Borrador'}
          </button>
          <button disabled={!canCalculate} style={{ ...btnPrimary, opacity: canCalculate ? 1 : .5, cursor: canCalculate ? 'pointer' : 'not-allowed' }} title={canCalculate ? 'Calcular recomendación' : 'Completa fertilizantes y dosis'}>
            <Calculator size={14} /> Calcular Recomendación
          </button>
        </div>
      </div>

      {/* Bloque A — Contexto */}
      <div style={styles.header}>
        <div style={styles.h1}><Leaf size={18} color="var(--primary)" /> Recomendación de Fertilización</div>
        <div style={styles.sub}>Define las fuentes de fertilizantes, su composición y dosis de aplicación para calcular el aporte total al cultivo.</div>

        <div style={styles.contextGrid}>
          {[
            { label: 'Cultivo', value: context.cultivo || context.cropName || '—', hint: context.variedad || '' },
            { label: 'Lote', value: context.lote || context.lotName || context.sectorName || '—', hint: context.predio || context.farmName || '' },
            { label: 'Área', value: localArea ? `${formatNum(localArea, 2)} ha` : '—', hint: 'Meta productiva' },
            { label: 'Plantas/ha', value: localPlants ? formatNum(localPlants, 0) : '—', hint: 'Densidad' },
            { label: 'Índice fertilidad', value: context.indiceFertilidad || context.fertilityIndex || '—', hint: 'Del análisis' },
            { label: 'Requerimiento', value: Object.keys(effectiveRequirements).length ? `${Object.keys(effectiveRequirements).length} nutrientes` : 'Pendiente', hint: 'Del Paso 2' },
          ].map((c) => (
            <div key={c.label} style={styles.ctxCard}>
              <div style={styles.ctxLabel}>{c.label}</div>
              <div style={styles.ctxValue}>{c.value}</div>
              {c.hint && <div style={styles.ctxHint}>{c.hint}</div>}
            </div>
          ))}
        </div>
        {Object.keys(effectiveRequirements).length === 0 && (
          <div style={infoBox}>
            <Info size={14} color="#2563EB" />
            <span style={{ fontSize: 12, color: '#1E40AF' }}>No hay requerimiento nutricional cargado. El aporte se calculará sin comparación de cobertura hasta que se complete el diagnóstico.</span>
          </div>
        )}
      </div>

      {/* Layout principal: izquierda tabla+ dosis, derecha aportes */}
      <div style={styles.gridMain} className="rec-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FertilizerRecommendationTable
            rows={rec.rows}
            rowErrors={rec.rowErrors}
            fertilizerOptions={fertilizerOptions}
            onUpdateRow={rec.updateRow}
            onUpdateNutrient={rec.updateNutrient}
            onUpdateCustomNutrient={rec.updateCustomNutrient}
            onRemoveCustomNutrient={rec.removeCustomNutrient}
            onAddCustomNutrient={rec.addCustomNutrient}
            onRemoveRow={rec.removeRow}
            onAddRow={rec.addRow}
            onLoadFromCatalog={rec.setRowFromCatalog}
          />

          <ApplicationDoseCard
            areaHa={localArea}
            globalPlantsPerHa={localPlants}
            doseMode={doseMode}
            doseValue={doseValue}
            presentationKg={presentationAvg}
            onChangeMode={setDoseMode}
            onChangeValue={setDoseValue}
            onChangeArea={setLocalArea}
            onChangePlants={setLocalPlants}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={applyGlobalDoseToEmpty} style={btnOutlineSm}>Aplicar dosis global a filas vacías</button>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>Cada fila mantiene su propia unidad; el sistema deriva kg/ha y bultos.</span>
          </div>

          {/* Método de cálculo + Notas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={styles.methodCard}>
              <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <FlaskConical size={14} color="var(--primary)" /> 3. Método de Cálculo
              </div>
              <label style={radioRow}>
                <input type="radio" checked={calcMethod === 'garantizado'} onChange={() => setCalcMethod('garantizado')} />
                <span style={radioLabel}>Porcentaje de nutrientes (Garantizado)</span>
              </label>
              <label style={radioRow}>
                <input type="radio" checked={calcMethod === 'laboratorio'} onChange={() => setCalcMethod('laboratorio')} />
                <span style={radioLabel}>Análisis de laboratorio del producto</span>
              </label>
              {calcMethod === 'laboratorio' && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.18)', fontSize: 12, color: '#1E40AF' }}>
                  Adjunta o registra los resultados de laboratorio para validar la composición garantizada.
                </div>
              )}
            </div>
            <div style={styles.methodCard}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Info size={14} color="var(--text-secondary)" /> Notas Adicionales
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe aquí tus observaciones o notas sobre la recomendación…"
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input,var(--bg-card))', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 12 }}>
          <NutrientContributionTable coverage={rec.report.coverage} totalContribution={rec.report.totalContribution} />
          <FertilizerContributionChart perFertilizer={rec.report.perFertilizer} />
          <ApplicationSummary totals={totalsForSummary} contributions={rec.report.totalContribution} />

          {(rec.report.hasDeficit || rec.report.hasExcess) && (
            <div style={warnBox}>
              <AlertTriangle size={14} color="#92400E" />
              <span style={{ fontSize: 12, color: '#92400E' }}>
                {rec.report.hasDeficit ? 'Déficit detectado en algunos nutrientes. ' : ''}
                {rec.report.hasExcess ? 'Exceso en otros — revisa cobertura.' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 1100px){ .rec-grid{ grid-template-columns: 1fr !important; } }`}</style>

      <div style={styles.footer}>
        <button onClick={() => onPrev && onPrev()} style={btnOutline}>
          <ArrowLeft size={14} /> Anterior
        </button>
        <button onClick={() => onNext && onNext({ rows: rec.rows, report: rec.report, notes })} style={btnPrimary}>
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnOutlineSm = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' };
const infoBox = { marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.18)', display: 'flex', gap: 8, alignItems: 'center' };
const warnBox = { padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', gap: 8, alignItems: 'center' };
const radioRow = { display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', cursor: 'pointer' };
const radioLabel = { fontSize: 13, color: 'var(--text-primary)' };
