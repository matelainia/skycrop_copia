/**
 * FertilizerRecommendationTable.jsx
 * Bloque principal: fertilizantes y composición garantizada (§5-§7).
 * Data-driven — columnas según enabledNutrients + custom.
 * Cada fila = un fertilizante con presentación, % nutrientes, dosis y acciones.
 */
import { useState } from 'react';
import { Trash2, Plus, Package, FlaskConical, X } from 'lucide-react';
import { PRESENTATION_OPTIONS, DOSE_MODES, nutrientLabel } from '../../types/recommendation.types.js';

const NUTRIENT_BASE = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S'];

function PresentationSelect({ value, customValue, onChange, onCustomChange }) {
  const isCustom = value === 'custom';
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 110 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
        style={selStyle}
      >
        {PRESENTATION_OPTIONS.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
      {isCustom && (
        <input
          type="number" min="0" step="0.5" placeholder="kg"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          style={{ ...inpStyle, width: 72 }}
        />
      )}
    </div>
  );
}

const thStyle = { padding: '10px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border-color)', textAlign: 'center' };
const thLeft = { ...thStyle, textAlign: 'left' };
const inpStyle = { width: '100%', padding: '8px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input,var(--bg-card))', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'center' };
const selStyle = { ...inpStyle, textAlign: 'left', cursor: 'pointer', minWidth: 96 };

export default function FertilizerRecommendationTable({
  rows,
  rowErrors,
  fertilizerOptions = [], // [{id, commercial_name, composition}] from Supabase productos/fert_calc_fertilizers
  onUpdateRow,
  onUpdateNutrient,
  onUpdateCustomNutrient,
  onRemoveCustomNutrient,
  onAddCustomNutrient,
  onRemoveRow,
  onAddRow,
  onLoadFromCatalog,
}) {
  const [customModalFor, setCustomModalFor] = useState(null);
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');

  // columnas visibles = unión de todos los enabledNutrients (para header estable)
  const allColumns = (() => {
    const set = new Set(NUTRIENT_BASE);
    rows.forEach((r) => (r.enabledNutrients || []).forEach((c) => set.add(c)));
    return [...set];
  })();

  return (
    <div style={cardOuter}>
      <div style={headerStyle}>
        <div style={secTitle}>
          <FlaskConical size={16} color="var(--primary)" />
          <span>1. Agregar Fertilizantes y Porcentajes de Nutrientes</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Composición garantizada (%)</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead>
            <tr>
              <th style={{ ...thLeft, minWidth: 160 }}>Fertilizante</th>
              <th style={{ ...thStyle, minWidth: 130 }}>Presentación</th>
              {allColumns.map((code) => (
                <th key={code} style={thStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {nutrientLabel(code)} (%)
                    {!NUTRIENT_BASE.includes(code) && (
                      <button
                        title={`Quitar ${code}`}
                        onClick={() => {
                          // quitar de todas las filas que lo tengan (solo primera para sim)
                          const first = rows.find((r) => (r.enabledNutrients || []).includes(code));
                          if (first) onRemoveCustomNutrient(first.id, code);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th style={thStyle}>Otros<br />Elementos (%)</th>
              <th style={thStyle}>Dosis</th>
              <th style={thStyle}>Unidad</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const errs = rowErrors[row.id];
              const hasError = !!errs;
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', background: hasError ? 'rgba(239,68,68,.04)' : 'transparent' }}>
                  {/* Fertilizante select/input */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                      <input
                        value={row.productName}
                        onChange={(e) => onUpdateRow(row.id, { productName: e.target.value })}
                        placeholder="Ej: MAP 12-24-12"
                        style={{ ...inpStyle, textAlign: 'left', borderColor: errs?.productName ? '#EF4444' : undefined }}
                        list={`fert-list-${row.id}`}
                      />
                      {fertilizerOptions.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const fid = e.target.value;
                            if (!fid) return;
                            const fert = fertilizerOptions.find((f) => String(f.id) === String(fid));
                            if (fert) onLoadFromCatalog(row.id, fert);
                          }}
                          style={{ ...selStyle, fontSize: 11, padding: '6px 8px' }}
                        >
                          <option value="">Cargar del catálogo…</option>
                          {fertilizerOptions.map((f) => (
                            <option key={f.id} value={f.id}>{f.commercial_name || f.commercialName || f.name || f.id}</option>
                          ))}
                        </select>
                      )}
                      {errs?.productName && <span style={errTxt}>{errs.productName}</span>}
                    </div>
                  </td>

                  {/* Presentación */}
                  <td style={tdStyle}>
                    <PresentationSelect
                      value={row.presentationKg}
                      customValue={row.presentationCustom}
                      onChange={(v) => onUpdateRow(row.id, { presentationKg: v })}
                      onCustomChange={(v) => onUpdateRow(row.id, { presentationCustom: v })}
                    />
                    {errs?.presentationKg && <span style={errTxt}>{errs.presentationKg}</span>}
                  </td>

                  {/* % nutrientes */}
                  {allColumns.map((code) => {
                    const isEnabled = (row.enabledNutrients || []).includes(code);
                    if (!isEnabled) {
                      return <td key={code} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>—</td>;
                    }
                    const isCustomCode = !NUTRIENT_BASE.includes(code) && !['N','P2O5','K2O','Ca','Mg','S','B','Zn','Fe','Mn','Cu','Mo'].includes(code);
                    const val = (row.customNutrients || []).find((c) => c.code === code)?.value ?? row.nutrients?.[code] ?? '';
                    return (
                      <td key={code} style={tdStyle}>
                        <input
                          type="number" min="0" max="100" step="0.1" placeholder="—"
                          value={val}
                          onChange={(e) => {
                            if (isCustomCode || (row.customNutrients || []).some((c) => c.code === code)) {
                              onUpdateCustomNutrient(row.id, code, e.target.value);
                            } else {
                              onUpdateNutrient(row.id, code, e.target.value);
                            }
                          }}
                          style={{ ...inpStyle, borderColor: errs?.composition ? '#EF4444' : undefined }}
                        />
                      </td>
                    );
                  })}

                  {/* Otros elementos trigger */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 92 }}>
                      {(row.customNutrients || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(row.customNutrients || []).map((c) => (
                            <span key={c.code} title={`${c.code}: ${c.value || '—'}%`} style={chipStyle}>
                              {c.code}: {c.value || '—'}%
                              <button onClick={() => onRemoveCustomNutrient(row.id, c.code)} style={chipXBtn}><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => setCustomModalFor(row.id)}
                        style={addElemBtn}
                      >
                        <Plus size={12} /> Agregar elemento
                      </button>
                    </div>
                  </td>

                  {/* Dosis + unidad */}
                  <td style={tdStyle}>
                    <input
                      type="number" min="0" step="0.01" placeholder="0"
                      value={row.doseValue}
                      onChange={(e) => onUpdateRow(row.id, { doseValue: e.target.value })}
                      style={{ ...inpStyle, minWidth: 78, borderColor: errs?.doseValue ? '#EF4444' : undefined }}
                    />
                    {errs?.doseValue && <span style={errTxt}>{errs.doseValue}</span>}
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={row.doseMode}
                      onChange={(e) => onUpdateRow(row.id, { doseMode: e.target.value })}
                      style={{ ...selStyle, minWidth: 110 }}
                    >
                      {DOSE_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </td>

                  {/* Acciones */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => onRemoveRow(row.id)}
                      disabled={rows.length <= 1}
                      title="Eliminar fertilizante"
                      style={{ ...iconBtn, opacity: rows.length <= 1 ? .4 : 1, cursor: rows.length <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <Trash2 size={15} color="#EF4444" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {Object.values(rowErrors).some((e) => e?.composition) && (
        <div style={warnBox}>
          <span style={{ fontSize: 12, color: '#92400E' }}>Revisa la composición: alguna fila tiene error de porcentaje.</span>
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onAddRow} style={addRowBtn}>
          <Plus size={14} /> Agregar Fertilizante
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>
          Usa “Agregar elemento” para registrar micronutrientes (B, Zn, Fe, Mn, Cu, Mo u otros).
        </span>
      </div>

      {/* Modal simple para agregar elemento */}
      {customModalFor && (
        <div style={modalBackdrop} onClick={() => { setCustomModalFor(null); setCustomCode(''); setCustomName(''); }}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Agregar elemento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lblSm}>Código (ej: B, Zn, Fe, Mn, Cu, Mo)</label>
                <input value={customCode} onChange={(e) => setCustomCode(e.target.value.toUpperCase())} placeholder="Ej: B" style={inpStyle} />
              </div>
              <div>
                <label style={lblSm}>Nombre (opcional)</label>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ej: Boro" style={inpStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => { setCustomModalFor(null); setCustomCode(''); setCustomName(''); }} style={btnGhost}>Cancelar</button>
                <button
                  onClick={() => {
                    if (!customCode.trim()) return;
                    onAddCustomNutrient(customModalFor, customCode.trim(), customName.trim() || customCode.trim());
                    setCustomModalFor(null); setCustomCode(''); setCustomName('');
                  }}
                  style={btnPrimary}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardOuter = { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', overflow: 'hidden', boxShadow: 'var(--fert-shadow,var(--card-shadow))' };
const headerStyle = { padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 };
const secTitle = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' };
const tdStyle = { padding: '10px 8px', verticalAlign: 'top' };
const errTxt = { fontSize: 11, color: '#EF4444', display: 'block', marginTop: 4 };
const warnBox = { margin: '0 16px', padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.25)' };
const addRowBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px dashed var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)' };
const addElemBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
const iconBtn = { padding: 8, borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: 'rgba(5,150,105,.10)', border: '1px solid rgba(5,150,105,.2)', fontSize: 11, fontWeight: 600, color: '#065F46' };
const chipXBtn = { background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', padding: 2, color: '#065F46' };
const lblSm = { fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' };
const btnPrimary = { padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' };
const btnGhost = { padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontWeight: 500 };
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard = { background: 'var(--bg-card)', borderRadius: 16, padding: 20, minWidth: 320, maxWidth: 420, width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,.2)' };
