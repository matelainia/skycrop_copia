/**
 * Step3BalanceAndSources.jsx
 * PASO 3 — Balance y Recomendación
 *
 * Arquitectura §10-§14:
 *   Muestra: Requerimiento (Paso2) | Aporte suelo (Paso1/SupplyEngine) | Déficit
 *   Luego permite registrar catálogo de fertilizantes para resolver dosis.
 *
 * Explica: "El cultivo requiere X; el suelo aporta aproximadamente Y; existe déficit Z;
 * por tanto la combinación recomendada es..."
 */
import { useEffect } from 'react';
import { FlaskConical, BarChart2, AlertTriangle, Calculator, Info, Leaf } from 'lucide-react';
import Step3Sources from './Step3Sources.jsx';

const NUTRIENT_LABELS = {
  N: 'Nitrógeno (N)', P2O5: 'Fósforo (P₂O₅)', K2O: 'Potasio (K₂O)',
  Ca: 'Calcio (Ca)', Mg: 'Magnesio (Mg)', S: 'Azufre (S)',
  B: 'Boro (B)', Zn: 'Zinc (Zn)', Fe: 'Hierro (Fe)', Mn: 'Manganeso (Mn)', Cu: 'Cobre (Cu)',
};
const NCOL = {
  N: { bg: 'rgba(37,99,235,.1)', text: '#2563EB', bar: '#3B82F6' },
  P2O5: { bg: 'rgba(234,88,12,.1)', text: '#EA580C', bar: '#F97316' },
  K2O: { bg: 'rgba(124,58,237,.1)', text: '#7C3AED', bar: '#8B5CF6' },
  Ca: { bg: 'rgba(5,150,105,.1)', text: '#059669', bar: '#10B981' },
  Mg: { bg: 'rgba(217,119,6,.1)', text: '#D97706', bar: '#F59E0B' },
  S: { bg: 'rgba(220,38,38,.1)', text: '#DC2626', bar: '#EF4444' },
  B: { bg: 'rgba(14,165,233,.1)', text: '#0284C7', bar: '#0EA5E9' },
  Zn: { bg: 'rgba(101,163,13,.1)', text: '#4D7C0F', bar: '#65A30D' },
  Fe: { bg: 'rgba(120,53,15,.1)', text: '#78350F', bar: '#A16207' },
  Mn: { bg: 'rgba(13,148,136,.1)', text: '#0D9488', bar: '#14B8A6' },
  Cu: { bg: 'rgba(185,28,28,.1)', text: '#B91C1C', bar: '#DC2626' },
};
const card = {
  background: 'var(--fert-card,var(--bg-card))',
  borderRadius: '16px',
  border: '1px solid var(--fert-border,var(--border-color))',
  padding: '20px 24px',
  boxShadow: 'var(--fert-shadow,var(--card-shadow))',
};
const sec = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' };

function formatNum(v, d = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: d });
}

export default function Step3BalanceAndSources({ calc }) {
  const { balancePreview, loadingBalance, fetchBalancePreview, realTimeBalance, form, errors, calculating, calculate, calcError } = calc;

  useEffect(() => {
    fetchBalancePreview();
  }, []); // carga inicial
  // Refrescar balance cuando cambian Paso 1/2 (no en cada dosis para no saturar backend)
  useEffect(() => {
    // solo si hay contexto mínimo para no disparar con datos incompletos
    if (form.cropId && form.stageId && form.targetYieldTHa) {
      const t = setTimeout(() => fetchBalancePreview(), 600);
      return () => clearTimeout(t);
    }
  }, [form.cropId, form.stageId, form.targetYieldTHa, form.soil?.pH, form.soil?.organicMatter, form.soil?.P, form.soil?.K, form.soil?.Ca, form.soil?.Mg, form.soil?.S, fetchBalancePreview]);

  // Excel dinámico: usa realTimeBalance (frontend puro) que ya incluye aporte fertilizante en tiempo real
  // Si aún no hay realTime (sin requerimientos), fallback a preview del backend
  const rtRows = realTimeBalance?.rows || {};
  const rtEntries = Object.entries(rtRows);
  const previewEntries = balancePreview?.balanceDetail ? Object.entries(balancePreview.balanceDetail) : [];
  // Priorizar realTime si tiene datos, si no usar preview
  const entries = rtEntries.length ? rtEntries.map(([code, v]) => [code, {
    requirement: v.required,
    soilContribution: v.soil,
    netDemand: v.deficit,
    fert: v.fert,
    balance: v.balance,
    coverage: v.coverage,
    status: v.status,
  }]) : previewEntries;
  const hasBalance = entries.length > 0;
  const maxReq = hasBalance ? Math.max(...entries.map(([, d]) => Math.max(d.requirement || 0, d.soilContribution || 0, d.fert || 0, d.netDemand || 0)), 1) : 1;
  // Para mostrar aporte fertilizante en tiempo real incluso cuando preview aún no llega
  const fertMap = realTimeBalance?.fertContribs || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Info */}
      <div style={{ ...card, padding: '14px 18px', background: 'rgba(5,150,105,.04)', borderColor: 'rgba(5,150,105,.18)' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Info size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Balance nutricional:</strong> el requerimiento no se resta directamente del análisis de suelo en ppm/cmol.
            SkyCrop convierte el análisis (método extracción × profundidad × densidad aparente × factor de aprovechamiento) a <em>aporte efectivo estimado (kg/ha)</em> y luego calcula <strong>Déficit = Demanda – Oferta</strong>.
            Usa el ajuste agronómico (pH, MO, textura, eficiencia) para la necesidad real de fertilización.
          </p>
        </div>
      </div>

      {/* Balance table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={sec}><BarChart2 size={16} color="var(--primary)" /><span>Balance nutricional</span></div>
          <button
            onClick={fetchBalancePreview}
            disabled={loadingBalance}
            style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', cursor: loadingBalance ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Calculator size={13} /> {loadingBalance ? 'Actualizando…' : 'Actualizar balance'}
          </button>
        </div>

        {!hasBalance ? (
          <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--text-secondary)' }}>
            <Leaf size={28} style={{ opacity: .35 }} />
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              {loadingBalance ? 'Calculando aporte estimado del suelo…' : 'Completa Paso 1 y Paso 2 para ver el balance. Luego registra fertilizantes abajo.'}
            </div>
            <div style={{ fontSize: '11px', marginTop: '6px', lineHeight: 1.4 }}>
              Requerimiento: {form.targetYieldTHa ? `${form.targetYieldTHa} t/ha` : 'pendiente'} · pH: {form.soil?.pH || '—'} · MO: {form.soil?.organicMatter ? `${form.soil.organicMatter}%` : '—'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr>
                    {['Nutriente','Requer.','Suelo*','Déficit','Aporte fert.','Balance','Cobertura','Estado'].map(h => (
                      <th key={h} style={{ padding: '9px 7px', textAlign: h==='Nutriente'?'left':'right', fontSize: '9.5px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([code, d]) => {
                    const col = NCOL[code] || NCOL.N;
                    // d puede venir de realTime (fert/balance/coverage) o de preview (netDemand)
                    const req = d.requirement ?? 0;
                    const soil = d.soilContribution ?? 0;
                    const deficit = d.netDemand ?? d.deficit ?? Math.max(0, req - soil);
                    const fert = d.fert ?? fertMap[code] ?? 0;
                    const balance = d.balance ?? (fert - deficit);
                    const coverage = d.coverage ?? (deficit>0 ? (fert/deficit)*100 : (fert>0?100:0));
                    const st = d.status || (coverage < 95 ? 'deficit' : coverage > 110 ? 'excess' : 'adequate');
                    const isOk = st === 'adequate';
                    const isDef = st === 'deficit';
                    const isExc = st === 'excess';
                    return (
                      <tr key={code} style={{ borderBottom: '1px solid var(--border-color)', background: isDef ? 'rgba(239,68,68,.02)' : isExc ? 'rgba(245,158,11,.04)' : 'transparent' }}>
                        <td style={{ padding: '10px 7px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.bar, display: 'inline-block' }} />
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '12px' }}>{NUTRIENT_LABELS[code] || code}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                            {balancePreview?.soilContext?.[code]?.classification ? `Suelo: ${balancePreview.soilContext[code].classification}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 7px', textAlign: 'right', fontWeight: '600' }}>{formatNum(req, 1)}</td>
                        <td style={{ padding: '10px 7px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatNum(soil, 1)}</td>
                        <td style={{ padding: '10px 7px', textAlign: 'right', fontWeight: '700', color: deficit>0.5 ? '#DC2626' : '#059669' }}>{deficit>0.5 ? formatNum(deficit,1) : '—'}</td>
                        <td style={{ padding: '10px 7px', textAlign: 'right', fontWeight: '800', color: fert>0 ? col.text : 'var(--text-muted)', background: fert>0 ? col.bg : 'transparent', borderRadius: '6px' }}>
                          {formatNum(fert, 1)}
                          {fert>0 && <div style={{ fontSize: '9px', fontWeight: 400, color: 'var(--text-secondary)' }}>kg/ha</div>}
                        </td>
                        <td style={{ padding: '10px 7px', textAlign: 'right', fontWeight: '700', color: balance < -0.5 ? '#DC2626' : balance > 0.5 ? '#D97706' : '#059669' }}>
                          {balance < -0.5 ? formatNum(balance,1) : balance > 0.5 ? `+${formatNum(balance,1)}` : '0'}
                          <div style={{ fontSize: '9px', fontWeight: 400, color: 'var(--text-secondary)' }}>{balance < -0.5 ? 'faltante' : balance>0.5 ? 'exceso' : 'óptimo'}</div>
                        </td>
                        <td style={{ padding: '10px 7px', textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: isOk ? '#059669' : isDef ? '#DC2626' : '#D97706' }}>
                            {deficit>0 ? `${formatNum(coverage,0)}%` : '—'}
                          </span>
                          {deficit>0 && (
                            <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border-color)', marginTop: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, coverage)}%`, background: isOk ? '#059669' : isDef ? '#EF4444' : '#F59E0B' }} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 7px', textAlign: 'right' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: '700', padding: '3px 7px', borderRadius: '20px', whiteSpace:'nowrap',
                            background: isOk ? 'rgba(5,150,105,.12)' : isDef ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.14)',
                            color: isOk ? '#059669' : isDef ? '#DC2626' : '#B45309'
                          }}>
                            {isOk ? 'Adecuado' : isDef ? 'Déficit' : 'Exceso'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5, display:'flex', gap:'12px', flexWrap:'wrap' }}>
              <span>* Suelo convertido agronómicamente (DA×prof×disponibilidad).</span>
              {balancePreview?.soilContext?.bulkDensity && <span>DA: {balancePreview.soilContext.bulkDensity}</span>}
              {realTimeBalance?.totalFertKgHa !== undefined && <span style={{ marginLeft:'auto', fontWeight:600, color: realTimeBalance.hasDeficit ? '#DC2626' : '#059669' }}>
                {realTimeBalance.hasDeficit ? `Faltante total: quedan nutrientes en déficit` : realTimeBalance.hasExcess ? `Aporte con excesos — revise` : `Cobertura completa — sin déficit`}
              </span>}
            </div>

            {/* Visual Excel dinámico: barras triple */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <BarChart2 size={13} color="var(--primary)" /> Visual Excel dinámico
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '11px' }}>(se actualiza al editar dosis/composición — el aporte fertilizante se ve en verde)</span>
              </div>
              {entries.map(([code, d]) => {
                const col = NCOL[code] || NCOL.N;
                const req = d.requirement ?? 0;
                const soil = d.soilContribution ?? 0;
                const fert = d.fert ?? fertMap[code] ?? 0;
                const deficit = d.netDemand ?? d.deficit ?? Math.max(0, req - soil);
                const reqPct = Math.min(100, (req / maxReq) * 100);
                const soilPct = Math.min(100, (soil / maxReq) * 100);
                const fertPct = Math.min(100, (fert / maxReq) * 100);
                return (
                  <div key={code}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap:'8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>{NUTRIENT_LABELS[code] || code}</span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace:'nowrap' }}>
                        {formatNum(req,1)} req · {formatNum(soil,1)} suelo · {formatNum(fert,1)} fert · <strong style={{ color: deficit>fert?'#DC2626': fert>deficit*1.1?'#D97706':'#059669' }}>{deficit>fert? `${formatNum(deficit-fert,1)} faltante` : fert>deficit? `+${formatNum(fert-deficit,1)} exceso` : 'cubierto'}</strong>
                      </span>
                    </div>
                    <div style={{ height: '10px', borderRadius: '5px', background: 'var(--border-color)', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(148,163,184,.22)', width: `${reqPct}%`, borderRadius: '5px' }} />
                      <div style={{ height: '100%', width: `${soilPct}%`, background: '#94A3B8', borderRadius: '5px', zIndex: 1, opacity: .9 }} title={`Suelo ${formatNum(soil,1)}`} />
                      <div style={{ height: '100%', width: `${fertPct}%`, background: col.bar, borderRadius: '5px', zIndex: 2, opacity: .95, marginLeft: '-1px', boxShadow: fert>0?'0 0 0 1px white':'' }} title={`Fert ${formatNum(fert,1)}`} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '12px', fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px', flexWrap:'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(148,163,184,.45)', borderRadius: 2, marginRight: 4, verticalAlign: '-1px' }} />Requerimiento</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#94A3B8', borderRadius: 2, marginRight: 4, verticalAlign: '-1px' }} />Suelo</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10B981', borderRadius: 2, marginRight: 4, verticalAlign: '-1px' }} />Aporte fertilizante (tiempo real)</span>
              </div>
            </div>

            {(balancePreview?.warnings || []).length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {balancePreview.warnings.map((w, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#92400E' }}>
                    <AlertTriangle size={13} color="#D97706" />{w}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Catálogo de fertilizantes */}
      <Step3Sources calc={calc} />

      {calcError && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{calcError}</span>
        </div>
      )}
      {errors.sourcesGlobal && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', fontSize: '13px', color: '#991B1B' }}>
          {errors.sourcesGlobal}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          onClick={calculate}
          disabled={calculating || !calc.sourcesValid?.()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px',
            background: calculating || !calc.sourcesValid?.() ? 'var(--border-color)' : 'var(--primary)',
            color: calculating || !calc.sourcesValid?.() ? 'var(--text-secondary)' : '#fff',
            border: 'none', fontWeight: '800', fontSize: '14px',
            cursor: calculating || !calc.sourcesValid?.() ? 'not-allowed' : 'pointer', opacity: calculating ? .7 : 1
          }}
        >
          <Calculator size={16} />
          {calculating ? 'Calculando…' : 'Calcular recomendación'}
        </button>
      </div>

      <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.15)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <FlaskConical size={16} color="#059669" style={{ marginTop: '1px', flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          El motor distingue <strong>requerimiento de dosis</strong>: 150 kg N/ha no implica aplicar 150 kg de urea. Considera eficiencia y aportes cruzados de los fertilizantes para minimizar costo y exceso.
          Luego verá dosis en kg/ha, kg/lote, bultos y g/planta.
        </p>
      </div>
    </div>
  );
}
