import { useMemo } from 'react';

const COST_CATEGORIES = [
  { label: 'Combustible (Diesel)', key: 'costFuel' },
  { label: 'Pago Operadores', key: 'costOperator' },
  { label: 'Servicio & Repuestos', key: 'costMaintenance' },
  { label: 'Depreciación Maquinaria', key: 'costDepreciation' }
];

export const ReportesPage = ({ machineryHook }) => {
  const machinery = machineryHook?.machinery || [];

  const costDistribution = useMemo(() => {
    if (!Array.isArray(machinery) || machinery.length === 0) return [];
    const totals = COST_CATEGORIES.map(c => ({
      label: c.label,
      total: machinery.reduce((sum, m) => sum + (parseFloat(m[c.key]) || 0), 0)
    }));
    const grand = totals.reduce((s, t) => s + t.total, 0);
    if (grand <= 0) return [];
    return totals.map(t => ({ ...t, pct: Math.round((t.total / grand) * 100) }));
  }, [machinery]);

  const maxPct = costDistribution.reduce((m, r) => Math.max(m, r.pct), 0);

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Informes de Rendimiento y Reportes de Flota</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Eficiencia de Labor por Operador</h4>
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Sin datos suficientes para generar este reporte.
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Distribución de Costos Totales</h4>
          {costDistribution.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Sin datos suficientes para generar este reporte.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              {costDistribution.map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                    <span>{row.label}</span>
                    <strong>{row.pct}%</strong>
                  </div>
                  <div className="progress-bar-container" style={{ height: '6px', margin: 0 }}>
                    <div className="progress-bar-fill" style={{ width: `${maxPct > 0 ? (row.pct / maxPct) * 100 : 0}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportesPage;
