
import { useMemo } from 'react';
import { costCalculator } from '../costs/costCalculator';

export const CostosPage = ({
  machineryHook,
  operationHook
}) => {
  const {
    machinery,
    selectedMachine,
    setSelectedMachine,
    handleUpdateRates
  } = machineryHook;
  const jornadas = operationHook?.jornadas || [];

  const totalHourlyCost = selectedMachine
    ? costCalculator.calculateHourlyRate(selectedMachine)
    : 0;

  const lotCosts = useMemo(() => {
    if (!Array.isArray(jornadas) || jornadas.length === 0) return [];
    const byLot = new Map();
    jornadas.forEach(j => {
      if (!j || !j.lot) return;
      const hours = Math.max(0, (Number(j.endHorometro) || 0) - (Number(j.startHorometro) || 0));
      if (hours <= 0) return;
      const machine = machinery.find(m => m.id === j.maquinariaId);
      const rate = machine ? costCalculator.calculateHourlyRate(machine) : 0;
      const prev = byLot.get(j.lot) || { lot: j.lot, cost: 0, hours: 0 };
      byLot.set(j.lot, { lot: j.lot, hours: prev.hours + hours, cost: prev.cost + hours * rate });
    });
    return Array.from(byLot.values())
      .map(r => ({ ...r, cost: Math.round(r.cost), hours: Math.round(r.hours * 10) / 10 }))
      .sort((a, b) => b.cost - a.cost);
  }, [jornadas, machinery]);

  const maxLotCost = lotCosts.reduce((m, r) => Math.max(m, r.cost), 0);

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Centro de Costos Operativos de Maquinaria</h3>
        <p className="section-desc">Configuración de costos por hora y análisis automático por lote y hectárea</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        
        {/* Left Form: Configure Rates */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>Configurar Tarifas por Hora</h4>

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Seleccionar Equipo</label>
            <select
              className="input-glass select-glass"
              style={{ width: '100%', fontSize: '13px' }}
              value={selectedMachine ? selectedMachine.id : ''}
              onChange={e => {
                const found = machinery.find(m => m.id === e.target.value);
                setSelectedMachine(found);
              }}
            >
              <option value="">-- Seleccionar Equipo --</option>
              {machinery.map(m => (
                <option key={m.id} value={m.id}>{m.codigoId} - {m.name}</option>
              ))}
            </select>
          </div>

          {selectedMachine ? (
            <form onSubmit={handleUpdateRates} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Costo Operador ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    value={selectedMachine.costOperator}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costOperator: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Costo Combustible ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    value={selectedMachine.costFuel}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costFuel: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Costo Mantenimiento ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    value={selectedMachine.costMaintenance}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costMaintenance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Costo Depreciación ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    value={selectedMachine.costDepreciation}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costDepreciation: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', marginTop: '6px' }}>
                Costo Total Estimado: <strong style={{ color: 'var(--primary)' }}>${totalHourlyCost.toFixed(2)} por hora</strong>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                Guardar Tarifas
              </button>
            </form>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Selecciona una máquina para configurar sus costos.
            </div>
          )}
        </div>

        {/* Right Details: Statistics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Costo Total por Lote (Historial de Labores)</h4>
            {lotCosts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Sin registros de labores para calcular costos por lote.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {lotCosts.map(stat => (
                  <div key={stat.lot} style={{ fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>{stat.lot} ({stat.hours} hs)</span>
                      <strong>${stat.cost.toLocaleString()} COP</strong>
                    </div>
                    <div className="progress-bar-container" style={{ height: '5px', margin: 0 }}>
                      <div className="progress-bar-fill" style={{ width: `${maxLotCost > 0 ? (stat.cost / maxLotCost) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent-cyan))' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Costo Promedio por Hectárea</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', textAlign: 'center' }}>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PREPARACIÓN SUELO</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '4px' }}>—</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sin datos suficientes</span>
              </div>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COSECHA MAÍZ</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '4px' }}>—</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sin datos suficientes</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CostosPage;
