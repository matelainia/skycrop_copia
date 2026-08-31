/**
 * ApplicationDoseCard.jsx
 * Bloque 2: Dosis de Aplicación (§8-§10).
 * Permite elegir magnitud primaria (kg/ha, kg/planta, bultos...) y muestra
 * inmediatamente los valores derivados. Una única fuente de verdad.
 */
import { Scale, Info } from 'lucide-react';
import { deriveDoseMetrics } from '../../calculations/doseCalculations.js';

const card = { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', padding: 20, boxShadow: 'var(--fert-shadow,var(--card-shadow))' };
const lbl = { fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6, display: 'block' };
const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input,var(--bg-card))', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const sel = { ...inp, cursor: 'pointer' };
const derivedBox = { padding: '10px 12px', borderRadius: 10, background: '#F4F8F5', border: '1px solid #D9DED9', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const badgeCalc = { fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(5,150,105,.12)', color: '#059669', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' };

function fmt(v, d = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: d });
}

export default function ApplicationDoseCard({
  areaHa,
  globalPlantsPerHa,
  doseMode, // 'kg_ha' | 'kg_planta' | 'g_planta' | 'bultos_ha' | 'bultos_lote' | 'kg_lote'
  doseValue,
  presentationKg, // para preview independiente (promedio)
  onChangeMode,
  onChangeValue,
  onChangeArea,
  onChangePlants,
}) {
  // vista derivada para el campo primario
  const preview = deriveDoseMetrics({
    mode: doseMode,
    value: doseValue,
    presentationKg: presentationKg || 50,
    plantsPerHa: globalPlantsPerHa,
    areaHa: areaHa,
  });

  const primaryUnitLabel =
    doseMode === 'kg_ha' ? 'kg/ha' :
    doseMode === 'kg_planta' ? 'kg/planta' :
    doseMode === 'g_planta' ? 'g/planta' :
    doseMode === 'bultos_ha' ? 'bultos/ha' :
    doseMode === 'bultos_lote' ? 'bultos/lote' :
    'kg/lote';

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
        <Scale size={16} color="var(--primary)" /> 2. Dosis de Aplicación
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
        {/* Modo */}
        <div>
          <label style={lbl}>Método de dosificación</label>
          <select value={doseMode} onChange={(e) => onChangeMode(e.target.value)} style={sel}>
            <option value="kg_ha">kg/ha</option>
            <option value="kg_planta">kg/planta</option>
            <option value="g_planta">g/planta</option>
            <option value="bultos_ha">bultos/ha</option>
            <option value="bultos_lote">bultos/lote</option>
            <option value="kg_lote">kg/lote</option>
          </select>
        </div>

        {/* Valor primario */}
        <div>
          <label style={lbl}>Dosis ({primaryUnitLabel}) <span style={{ color: '#EF4444' }}>*</span></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" min="0" step="0.01" value={doseValue} onChange={(e) => onChangeValue(e.target.value)} placeholder="0" style={inp} />
            <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-secondary)', minWidth: 54 }}>{primaryUnitLabel}</span>
          </div>
        </div>

        {/* Plantas/ha */}
        <div>
          <label style={lbl}>Número de plantas/ha</label>
          <input type="number" min="0" step="1" value={globalPlantsPerHa ?? ''} onChange={(e) => onChangePlants(e.target.value)} placeholder="Ej: 4000" style={inp} />
        </div>

        {/* Área */}
        <div>
          <label style={lbl}>Área del lote (ha)</label>
          <input type="number" min="0" step="0.01" value={areaHa ?? ''} onChange={(e) => onChangeArea(e.target.value)} placeholder="0.00" style={inp} />
        </div>
      </div>

      {/* Derivados en tiempo real (§20) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
        <div>
          <span style={lbl}>Dosis por hectárea</span>
          <div style={derivedBox}>
            <span>{fmt(preview.kgPerHa, 2)} kg/ha</span>
            {doseMode !== 'kg_ha' && <span style={badgeCalc}>Calculado</span>}
          </div>
        </div>
        <div>
          <span style={lbl}>Dosis por planta</span>
          <div style={derivedBox}>
            <span>{fmt(preview.gPerPlant, 1)} g/planta</span>
            <span style={badgeCalc}>Calculado</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{fmt(preview.kgPerPlant, 4)} kg/planta</div>
        </div>
        <div>
          <span style={lbl}>Bultos/ha</span>
          <div style={derivedBox}>
            <span>{fmt(preview.bagsPerHa, 2)} bultos/ha</span>
            <span style={badgeCalc}>Calculado</span>
          </div>
        </div>
        <div>
          <span style={lbl}>Dosis total a aplicar</span>
          <div style={{ ...derivedBox, background: 'rgba(5,150,105,.08)', borderColor: 'rgba(5,150,105,.25)', color: '#059669', fontWeight: 800, fontSize: 15 }}>
            <span>{fmt(preview.kgPerHa, 2)} kg/ha</span>
          </div>
        </div>
      </div>

      {/* Totales por lote si aplica */}
      {(doseMode === 'bultos_lote' || doseMode === 'kg_lote') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <span style={lbl}>Total lote</span>
            <div style={derivedBox}><span>{fmt(preview.kgTotal, 0)} kg totales</span></div>
          </div>
          <div>
            <span style={lbl}>Bultos totales</span>
            <div style={derivedBox}><span>{fmt(preview.bagsPerLot, 0)} bultos</span></div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.18)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Info size={14} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
          El usuario introduce una magnitud primaria y SkyCrop calcula las demás. No permitas valores inconsistentes simultáneos.
        </span>
      </div>
    </div>
  );
}
