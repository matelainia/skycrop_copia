import { memo } from 'react';
import { FlaskConical, CalendarDays, MapPinned, Building2, TrendingUp } from 'lucide-react';
import { formatDateShort, daysAgo } from '../../utils/formatSoilAnalysis.js';

function MetricSkeleton() {
  return (
    <div className="soil-metric-card" style={{ opacity: 0.6 }}>
      <div className="soil-skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="soil-skeleton" style={{ height: 18, width: 60, borderRadius: 6 }} />
        <div className="soil-skeleton" style={{ height: 10, width: 100, borderRadius: 6 }} />
      </div>
    </div>
  );
}

const SoilMetrics = memo(function SoilMetrics({ metrics, loading = false }) {
  if (loading) {
    return (
      <div className="soil-metrics">
        {[1, 2, 3, 4, 5].map((i) => <MetricSkeleton key={i} />)}
      </div>
    );
  }

  const total = metrics?.total ?? 0;
  const esteAno = metrics?.esteAno ?? metrics?.este_ano ?? 0;
  const zonas = metrics?.zonas ?? 0;
  const laboratorios = metrics?.laboratorios ?? 0;
  const ultimo = metrics?.ultimo;

  const ultimoLabel = ultimo?.fecha_analisis ? formatDateShort(ultimo.fecha_analisis) : '—';
  const ultimoAgo = ultimo?.fecha_analisis ? daysAgo(ultimo.fecha_analisis) : 'Sin registros';

  return (
    <div className="soil-metrics" role="region" aria-label="Métricas de análisis de suelos">
      <div className="soil-metric-card">
        <div className="soil-metric-card__icon"><FlaskConical size={18} /></div>
        <div className="soil-metric-card__body">
          <div className="soil-metric-card__value">{total}</div>
          <div className="soil-metric-card__label">Total análisis</div>
          <div className="soil-metric-card__note">Todos los registros</div>
        </div>
      </div>

      <div className="soil-metric-card">
        <div className="soil-metric-card__icon"><CalendarDays size={18} /></div>
        <div className="soil-metric-card__body">
          <div className="soil-metric-card__value">{esteAno}</div>
          <div className="soil-metric-card__label">Este año</div>
          <div className="soil-metric-card__note">Análisis realizados</div>
        </div>
      </div>

      <div className="soil-metric-card">
        <div className="soil-metric-card__icon"><MapPinned size={18} /></div>
        <div className="soil-metric-card__body">
          <div className="soil-metric-card__value">{zonas}</div>
          <div className="soil-metric-card__label">Zonas muestreadas</div>
          <div className="soil-metric-card__note">Áreas diferentes</div>
        </div>
      </div>

      <div className="soil-metric-card">
        <div className="soil-metric-card__icon"><Building2 size={18} /></div>
        <div className="soil-metric-card__body">
          <div className="soil-metric-card__value">{laboratorios}</div>
          <div className="soil-metric-card__label">Laboratorios</div>
          <div className="soil-metric-card__note">Laboratorios distintos</div>
        </div>
      </div>

      <div className="soil-metric-card">
        <div className="soil-metric-card__icon"><TrendingUp size={18} /></div>
        <div className="soil-metric-card__body">
          <div className="soil-metric-card__value" style={{ fontSize: ultimo ? 16 : 22 }}>{ultimoLabel}</div>
          <div className="soil-metric-card__label">Último análisis</div>
          <div className="soil-metric-card__note">{ultimoAgo}</div>
        </div>
      </div>
    </div>
  );
});

export default SoilMetrics;
