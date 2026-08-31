/**
 * ApplicationSummary.jsx
 * Resumen de aplicación — 4 tarjetas (§14).
 */
import { Scale, Sprout, Package, Weight } from 'lucide-react';

function fmt(v, d = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es', { maximumFractionDigits: d });
}

const cardOuter = { background: 'var(--fert-card,var(--bg-card))', borderRadius: 16, border: '1px solid var(--fert-border,var(--border-color))', padding: 16, boxShadow: 'var(--fert-shadow,var(--card-shadow))' };

export default function ApplicationSummary({ totals, contributions }) {
  const topNutrients = Object.entries(contributions || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div style={cardOuter}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>Resumen de Aplicación</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Dosis total', value: fmt(totals?.doseTotalKgHa, 2), unit: 'kg/ha', icon: Scale, color: '#059669' },
          { label: 'Dosis/planta', value: fmt(totals?.doseTotalGPlant, 1), unit: 'g/planta', sub: totals?.doseTotalKgPlant !== null ? `${fmt(totals.doseTotalKgPlant, 3)} kg/planta` : null, icon: Sprout, color: '#059669' },
          { label: 'Bultos', value: fmt(totals?.totalBags, 1), unit: 'bultos/ha', icon: Package, color: '#DC2626' },
          { label: 'Presentación', value: totals?.presentationLabel || '—', unit: 'por bulto', icon: Weight, color: '#7C3AED' },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${c.color}15`, color: c.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Icon size={14} />
              </div>
              <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.unit}</div>
              {c.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.sub}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>Aporte total</div>
        {topNutrients.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sin aporte calculado.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {topNutrients.map(([code, val]) => (
              <span key={code} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {code} <span style={{ color: '#059669' }}>{fmt(val, 1)} kg/ha</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
