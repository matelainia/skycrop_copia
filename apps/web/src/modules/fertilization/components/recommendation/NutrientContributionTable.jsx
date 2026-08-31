/**
 * NutrientContributionTable.jsx
 * Tarjeta derecha: Aporte total de nutrientes (§12).
 * Diferencia datos: introducido vs calculado vs requerimiento.
 */
import { TrendingUp, Target } from 'lucide-react';

const cardOuter = { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', overflow: 'hidden', boxShadow: 'var(--fert-shadow,var(--card-shadow))' };

function statusBadge(status) {
  const map = {
    optimo:   { l: 'Óptimo',   bg: 'rgba(5,150,105,.12)',  c: '#059669', border: 'rgba(5,150,105,.25)' },
    adecuado: { l: 'Adecuado', bg: 'rgba(245,158,11,.12)', c: '#92400E', border: 'rgba(245,158,11,.25)' },
    bajo:     { l: 'Bajo',     bg: 'rgba(239,68,68,.12)',  c: '#B91C1C', border: 'rgba(239,68,68,.25)' },
    exceso:   { l: 'Exceso',   bg: 'rgba(245,158,11,.14)', c: '#B45309', border: 'rgba(245,158,11,.25)' },
    sin_dato: { l: '—',        bg: 'rgba(107,114,128,.08)', c: '#6B7280', border: 'rgba(107,114,128,.15)' },
  };
  const cfg = map[status] || map.sin_dato;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.c, border: `1px solid ${cfg.border}` }}>
      {cfg.l}
    </span>
  );
}

function fmt(v, d = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: d });
}

export default function NutrientContributionTable({ coverage, totalContribution }) {
  const entries = Object.entries(coverage || {});
  const hasData = entries.length > 0;

  // calcular kg/ha promedio para subtítulo (como en imagen: "Calculado para 200 kg/ha")
  const totalKgHa = Object.values(totalContribution || {}).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div style={cardOuter}>
      <div style={{ padding: '16px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
          <TrendingUp size={14} color="var(--primary)" /> Aporte Total de Nutrientes
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          {hasData ? `Calculado — aporte total ${fmt(totalKgHa, 1)} kg/ha` : 'Sin aporte calculado aún'}
        </div>
      </div>

      {!hasData ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Agrega fertilizantes y dosis para ver el aporte nutricional.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={th}>Nutriente</th>
                <th style={{ ...th, textAlign: 'right' }}>Aporte (kg/ha)</th>
                <th style={{ ...th, textAlign: 'right' }}>% del Requerimiento</th>
                <th style={{ ...th, textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([code, info]) => (
                <tr key={code} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={td}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{code}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 11 }}>{codeMeta(code)}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(info.supplied, 2)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: coverageColor(info.coverage, info.status) }}>
                    {info.coverage !== null ? `${fmt(info.coverage, 1)}%` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>{statusBadge(info.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Target size={12} /> Requerimiento del cultivo</span>
        <span>Ver detalle de requerimientos →</span>
      </div>
    </div>
  );
}

function codeMeta(code) {
  const m = { N: '(Nitrógeno)', P2O5: '(Fósforo)', K2O: '(Potasio)', Ca: '(Calcio)', Mg: '(Magnesio)', S: '(Azufre)', B: '(Boro)', Zn: '(Zinc)', Fe: '(Hierro)', Mn: '(Manganeso)', Cu: '(Cobre)', Mo: '(Molibdeno)' };
  return m[code] || '';
}
function coverageColor(cov, status) {
  if (status === 'bajo') return '#B91C1C';
  if (status === 'exceso') return '#B45309';
  if (status === 'optimo') return '#059669';
  if (cov === null) return 'var(--text-secondary)';
  return cov >= 95 && cov <= 105 ? '#059669' : '#92400E';
}
const th = { padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textAlign: 'left', borderBottom: '1px solid var(--border-color)' };
const td = { padding: '9px 10px', verticalAlign: 'middle' };
