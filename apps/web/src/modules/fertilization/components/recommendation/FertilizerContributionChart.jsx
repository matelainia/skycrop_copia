/**
 * FertilizerContributionChart.jsx
 * Visualización horizontal por fertilizante (§13).
 * Interactivo, identifica qué producto suministra cada nutriente.
 */
import { BarChart3 } from 'lucide-react';

const NCOL = {
  N:    { bg: '#3B82F6', light: 'rgba(59,130,246,.18)' },
  P2O5: { bg: '#F97316', light: 'rgba(249,115,22,.18)' },
  K2O:  { bg: '#8B5CF6', light: 'rgba(139,92,246,.18)' },
  Ca:   { bg: '#10B981', light: 'rgba(16,185,129,.18)' },
  Mg:   { bg: '#F59E0B', light: 'rgba(245,158,11,.18)' },
  S:    { bg: '#EF4444', light: 'rgba(239,68,68,.18)' },
  B:    { bg: '#0EA5E9', light: 'rgba(14,165,233,.18)' },
  Zn:   { bg: '#65A30D', light: 'rgba(101,163,13,.18)' },
  Fe:   { bg: '#A16207', light: 'rgba(161,98,7,.18)' },
  Mn:   { bg: '#7C3AED', light: 'rgba(124,58,237,.18)' },
  Cu:   { bg: '#DB2777', light: 'rgba(219,39,119,.18)' },
  Mo:   { bg: '#059669', light: 'rgba(5,150,105,.18)' },
};

function fmt(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(1).replace(/\.0$/, '');
}

export default function FertilizerContributionChart({ perFertilizer }) {
  const hasData = perFertilizer && perFertilizer.length > 0;

  // para normalizar barras: máximo aporte puntual entre todos los nutrientes
  const maxVal = hasData
    ? Math.max(1, ...perFertilizer.flatMap((f) => Object.values(f.contributions || {}).map(Number)).filter(Number.isFinite))
    : 1;

  return (
    <div style={cardOuter}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>
        <BarChart3 size={14} color="var(--primary)" /> Contribución por Fertilizante
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4 }}>Aporte de nutrientes (kg/ha)</span>
      </div>

      {!hasData ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: 18 }}>Sin datos para graficar.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {perFertilizer.map((f) => {
            const contribs = f.contributions || {};
            const nutrients = Object.keys(contribs).filter((k) => Number(contribs[k]) > 0);
            return (
              <div key={f.id}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{f.name}</div>
                {nutrients.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sin aporte registrado</div>
                ) : (
                  <div style={{ display: 'flex', gap: 4, height: 18, borderRadius: 8, overflow: 'hidden', background: 'var(--border-color)', padding: 2 }}>
                    {nutrients.map((code) => {
                      const val = Number(contribs[code]);
                      const pct = Math.max(6, (val / maxVal) * 100); // mínimo visible
                      const col = NCOL[code] || NCOL.N;
                      return (
                        <div
                          key={code}
                          title={`${code}: ${fmt(val)} kg/ha`}
                          style={{
                            flex: `${pct} 1 0`,
                            background: col.bg,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            minWidth: 22,
                          }}
                        >
                          {fmt(val)}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* leyenda */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {nutrients.map((code) => (
                    <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: (NCOL[code] || NCOL.N).bg, display: 'inline-block' }} />{code}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* leyenda global */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-color)', fontSize: 10, color: 'var(--text-secondary)' }}>
        {Object.entries(NCOL).slice(0, 8).map(([code, col]) => (
          <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: col.bg, display: 'inline-block' }} />{code}
          </span>
        ))}
      </div>
    </div>
  );
}

const cardOuter = { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', padding: 16, boxShadow: 'var(--fert-shadow,var(--card-shadow))' };
