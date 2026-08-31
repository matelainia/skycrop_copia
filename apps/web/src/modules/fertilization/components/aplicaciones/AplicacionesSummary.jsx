import { memo } from 'react';
import { Droplets, CalendarDays, MapPinned, Layers } from 'lucide-react';
import { formatKgCO, formatIntegerCO, formatAppDate, formatRelativeDays } from '../../utils/formatAplicaciones.js';

/**
 * AplicacionesSummary — 4 tarjetas de métricas reales.
 * Si no hay datos, muestra 0 / estados vacíos sin inventar.
 */
const Card = memo(function Card({ icon: Icon, iconVariant, label, value, note, noteVariant = 'info' }) {
  return (
    <div className="fert-card fert-card--static app-summary-card" style={{ transition: 'transform 180ms ease, box-shadow 180ms ease' }}>
      <div className={`fert-metric-card__icon-tile fert-metric-card__icon-tile--${iconVariant}`} aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="fert-metric-card__body">
        <div className="fert-metric-card__label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </div>
        <div className="fert-metric-card__value" style={{ marginTop: 4 }}>
          {value}
        </div>
        <div className={`fert-metric-card__note fert-metric-card__note--${noteVariant}`} style={{ fontSize: '11px' }}>
          {note}
        </div>
      </div>
    </div>
  );
});

function AplicacionesSummary({ stats, statsLoading }) {
  if (statsLoading) {
    return (
      <div className="app-summary-grid" role="status" aria-label="Cargando métricas de aplicaciones">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="fert-card fert-card--static app-summary-card">
            <div className="fert-skeleton" style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="fert-skeleton fert-skeleton--text" style={{ width: '60%', height: 10 }} />
              <div className="fert-skeleton" style={{ width: '40%', height: 22, borderRadius: 6 }} />
              <div className="fert-skeleton fert-skeleton--text" style={{ width: '50%', height: 10 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const lastAppDate = stats?.lastApp?.scheduled_date || stats?.lastApp?.completed_date || null;
  const lotsWithApps = stats?.lotsWithApps ?? 0;
  const totalLots = stats?.totalLots ?? 0;
  const nutrientsKg = stats?.nutrientsKg ?? 0;

  return (
    <div className="app-summary-grid" role="region" aria-label="Resumen de aplicaciones">
      <Card
        icon={Layers}
        iconVariant="green"
        label="Aplicaciones Totales"
        value={formatIntegerCO(total)}
        note={total === 0 ? 'Sin aplicaciones registradas' : 'Este año'}
        noteVariant={total === 0 ? 'info' : 'info'}
      />
      <Card
        icon={CalendarDays}
        iconVariant="blue"
        label="Última Aplicación"
        value={lastAppDate ? formatAppDate(lastAppDate) : '—'}
        note={lastAppDate ? formatRelativeDays(lastAppDate) : 'Sin registros'}
        noteVariant="info"
      />
      <Card
        icon={MapPinned}
        iconVariant="cyan"
        label="Lotes con Aplicaciones"
        value={formatIntegerCO(lotsWithApps)}
        note={totalLots > 0 ? `De ${totalLots} lotes` : 'Sin lotes'}
        noteVariant="info"
      />
      <Card
        icon={Droplets}
        iconVariant="orange"
        label="Nutrientes Aplicados"
        value={nutrientsKg > 0 ? formatKgCO(nutrientsKg) : '0 kg'}
        note={nutrientsKg > 0 ? 'NPK + Elementos' : 'Sin aplicaciones'}
        noteVariant="info"
      />
    </div>
  );
}

export default memo(AplicacionesSummary);
