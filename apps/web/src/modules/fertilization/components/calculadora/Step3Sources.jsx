/**
 * Step3Sources.jsx
 * PASO 3 — Fuentes Fertilizantes.
 *
 * El usuario registra las fuentes fertilizantes y sus composiciones
 * garantizadas. SkyCrop obtiene el requerimiento nutricional desde el
 * diagnóstico y el motor determina automáticamente la combinación y dosis.
 *
 * REGLAS:
 *  - La composición NUNCA se asume: se precarga del catálogo maestro o la
 *    registra el usuario; siempre queda visible y editable para confirmación.
 *  - Precio y disponibilidad son opcionales.
 *  - No hay datos mock: si el catálogo no está disponible, se registra manual.
 */
import { Plus, Trash2, Package, FlaskConical, Info, Calculator } from 'lucide-react';
import { SOURCE_NUTRIENTS } from '../../hooks/useCalculadora.js';

const NUTRIENT_LABELS = {
  N: 'N', P2O5: 'P₂O₅', K2O: 'K₂O', Ca: 'Ca', Mg: 'Mg', S: 'S', B: 'B', Zn: 'Zn',
};

const card = {
  background: 'var(--fert-card,var(--bg-card))',
  borderRadius: '16px',
  border: '1px solid var(--fert-border,var(--border-color))',
  padding: '24px',
  boxShadow: 'var(--fert-shadow,var(--card-shadow))',
};
const sec = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' };
const lbl = { fontSize: '11px', fontWeight: '600', letterSpacing: '.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' };
const inp = (err) => ({
  width: '100%', padding: '10px 12px', background: 'var(--bg-input,var(--bg-card))',
  border: `1px solid ${err ? '#EF4444' : 'var(--border-color)'}`, borderRadius: '10px',
  fontSize: '14px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
});
const errT = { fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' };

function SourceCard({ source, index, errors, catalog, onRemove, onField, onComposition, onLoadCatalog, onSuggestDose }) {
  const rowErr = errors?.[index];
  const compTotal = Object.values(source.composition)
    .map((v) => parseFloat(v))
    .filter((v) => !Number.isNaN(v) && v > 0)
    .reduce((s, v) => s + v, 0);
  // Cálculo de aporte por dosis para preview Excel inmediato
  const doseNum = parseFloat(source.doseKgHa);
  const hasDose = Number.isFinite(doseNum) && doseNum > 0;
  const perNutrientPreview = hasDose ? Object.entries(source.composition)
    .map(([nut, pctStr]) => {
      const pct = parseFloat(pctStr);
      if (!pct || pct <= 0) return null;
      return { nut, kg: (doseNum * pct) / 100 };
    }).filter(Boolean) : [];

  return (
    <div style={{ padding: '18px', borderRadius: '14px', background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.9fr 0.8fr 0.8fr 0.7fr auto', gap: '12px', alignItems: 'start' }}>
        <div>
          <label style={lbl}>Producto <span style={{ color: '#EF4444' }}>*</span></label>
          <input
            style={inp(rowErr?.name)}
            placeholder="Ej: MAP 12-24-0"
            value={source.name}
            onChange={(e) => onField(source.key, 'name', e.target.value)}
          />
          {catalog.length > 0 && (
            <select
              style={{ ...inp(), marginTop: '6px', cursor: 'pointer', fontSize: '12px' }}
              value=""
              onChange={(e) => e.target.value && onLoadCatalog(source.key, e.target.value)}
            >
              <option value="">Cargar del catálogo…</option>
              {catalog.map((f) => (
                <option key={f.id} value={f.id}>{f.commercialName || f.name || f.id}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={lbl}>Dosis (kg/ha) <span style={{ color: '#059669', fontWeight: '700' }}>● Excel</span></label>
          <input
            style={inp(rowErr?.doseKgHa)}
            type="number" min="0" step="1" placeholder="Ej: 100"
            value={source.doseKgHa}
            onChange={(e) => onField(source.key, 'doseKgHa', e.target.value)}
          />
          <button
            onClick={() => onSuggestDose && onSuggestDose(source.key)}
            title="Sugerir dosis para cubrir déficit del nutriente principal"
            style={{ marginTop: '4px', fontSize: '10px', padding: '4px 6px', borderRadius: '6px', border: '1px dashed var(--primary)', background: 'rgba(5,150,105,.06)', cursor: 'pointer', color: 'var(--primary)', fontWeight: '700', width: '100%' }}
          >
            Sugerir dosis
          </button>
          {hasDose && (
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.3 }}>
              {perNutrientPreview.slice(0,3).map(p => `${p.nut}:${p.kg.toFixed(1)}`).join(' · ')}{perNutrientPreview.length>3?'…':''}
            </div>
          )}
        </div>
        <div>
          <label style={lbl}>Presentación (kg/bulto)</label>
          <input
            style={inp()}
            type="number" min="0" step="0.5" placeholder="50"
            value={source.presentationKg}
            onChange={(e) => onField(source.key, 'presentationKg', e.target.value)}
          />
        </div>
        <div>
          <label style={lbl}>Precio/unidad</label>
          <input
            style={inp()}
            type="number" min="0" step="0.01" placeholder="Opcional"
            value={source.pricePerUnit}
            onChange={(e) => onField(source.key, 'pricePerUnit', e.target.value)}
          />
        </div>
        <div>
          <label style={lbl}>Disponible</label>
          <button
            onClick={() => onField(source.key, 'available', !source.available)}
            title={source.available ? 'Disponible para formular' : 'Excluido de la formulación'}
            style={{
              width: '42px', height: '24px', marginTop: '2px', borderRadius: '12px',
              background: source.available ? 'var(--primary)' : 'var(--border-color)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'all .2s',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
              background: '#fff', transition: 'left .2s', left: source.available ? '21px' : '3px',
            }} />
          </button>
        </div>
        <button
          onClick={() => onRemove(source.key)}
          disabled={!onRemove}
          title="Quitar fuente"
          style={{
            marginTop: '22px', padding: '8px', borderRadius: '10px', border: '1px solid var(--border-color)',
            background: 'transparent', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center',
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label style={{ ...lbl, marginBottom: 0 }}>Composición garantizada (%) <span style={{ color: '#EF4444' }}>*</span></label>
          <span style={{
            fontSize: '11px', fontWeight: '600',
            color: compTotal > 100 ? '#EF4444' : 'var(--text-secondary)',
          }}>
            Σ = {compTotal.toFixed(2).replace(/\.00$/, '')}%
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px', marginTop: '8px' }}>
          {SOURCE_NUTRIENTS.map((nutrient) => (
            <div key={nutrient}>
              <input
                style={{
                  ...inp(rowErr?.composition), textAlign: 'center',
                  fontWeight: '600', padding: '9px 6px',
                }}
                type="number" min="0" max="100" step="0.1"
                placeholder="0"
                aria-label={`% ${NUTRIENT_LABELS[nutrient]}`}
                value={source.composition[nutrient]}
                onChange={(e) => onComposition(source.key, nutrient, e.target.value)}
              />
              <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px', fontWeight: '600' }}>
                {NUTRIENT_LABELS[nutrient]}
              </div>
            </div>
          ))}
        </div>
        {rowErr && <span style={errT}>{rowErr.name || rowErr.composition}</span>}
      </div>
    </div>
  );
}

export default function Step3Sources({ calc }) {
  const {
    sources, sourceErrors, errors, fertilizerCatalog,
    addSource, removeSource, updateSource, updateSourceComposition, loadFromCatalog,
    suggestDoseForSource, autoSuggestAllDoses, realTimeBalance,
  } = calc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ ...card, padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Info size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Registra las fuentes fertilizantes que tienes disponibles y su composición garantizada.
            SkyCrop obtiene el requerimiento nutricional desde el diagnóstico (Pasos 1–2) y el motor
            determina automáticamente la combinación y dosis de productos que mejor lo cubre:
            kg/ha, kg/lote, bultos y aporte real por nutriente.
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={{ ...sec, marginBottom: '12px', justifyContent: 'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <FlaskConical size={16} color="#7C3AED" />
            <span>Fuentes Fertilizantes ({sources.length})</span>
            {realTimeBalance && (
              <span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'20px', background: realTimeBalance.hasDeficit ? 'rgba(239,68,68,.12)' : 'rgba(5,150,105,.12)', color: realTimeBalance.hasDeficit ? '#DC2626' : '#059669', fontWeight:'700' }}>
                {realTimeBalance.hasDeficit ? `Déficit: editar dosis` : realTimeBalance.hasExcess ? 'Exceso: revise dosis' : 'Cobertura completa'}
              </span>
            )}
          </div>
          <button
            onClick={autoSuggestAllDoses}
            title="Calcula dosis para que el aporte cubra el déficit (Excel dinámico)"
            style={{ padding:'7px 12px', borderRadius:'10px', border:'1px solid var(--primary)', background:'rgba(5,150,105,.08)', cursor:'pointer', fontSize:'12px', fontWeight:'700', color:'var(--primary)', display:'flex', alignItems:'center', gap:'6px' }}
          >
            <Calculator size={13} /> Auto-ajustar dosis
          </button>
        </div>

        {errors.sourcesGlobal && <span style={{ ...errT, marginTop: 0, marginBottom: '10px' }}>{errors.sourcesGlobal}</span>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {sources.map((source, index) => (
            <SourceCard
              key={source.key}
              source={source}
              index={index}
              errors={sourceErrors}
              catalog={fertilizerCatalog}
              onRemove={sources.length > 1 ? removeSource : null}
              onField={updateSource}
              onComposition={updateSourceComposition}
              onLoadCatalog={loadFromCatalog}
              onSuggestDose={suggestDoseForSource}
            />
          ))}
        </div>

        <button
          onClick={addSource}
          style={{
            marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '12px', border: '1px dashed var(--border-color)',
            background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            color: 'var(--primary)', width: '100%', justifyContent: 'center',
          }}
        >
          <Plus size={15} /> Agregar fuente fertilizante
        </button>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Package size={16} color="#059669" style={{ marginTop: '1px', flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          La presentación (kg/bulto) permite redondear la recomendación a bultos comerciales y recalcular
          los aportes reales. El precio es opcional: sin precio, el costo se muestra como «—».
        </p>
      </div>
    </div>
  );
}
