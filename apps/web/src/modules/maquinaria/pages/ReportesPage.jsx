

export const ReportesPage = () => {
  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Informes de Rendimiento y Reportes de Flota</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Eficiencia de Labor por Operador</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            {[
              { op: 'Juan Pérez', rate: '94% (Excelente)' },
              { op: 'Carlos Ruiz', rate: '92% (Excelente)' },
              { op: 'Sofia Diaz', rate: '89% (Óptimo)' },
              { op: 'Mateo Ortiz', rate: '85% (Regular)' }
            ].map((row, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span>{row.op}</span>
                <strong>{row.rate}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Distribución de Costos Totales</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            {[
              { label: 'Combustible (Diesel)', pct: 45 },
              { label: 'Pago Operadores', pct: 30 },
              { label: 'Servicio & Repuestos', pct: 15 },
              { label: 'Depreciación Maquinaria', pct: 10 }
            ].map((row, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span>{row.label}</span>
                  <strong>{row.pct}%</strong>
                </div>
                <div className="progress-bar-container" style={{ height: '6px', margin: 0 }}>
                  <div className="progress-bar-fill" style={{ width: `${row.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportesPage;
