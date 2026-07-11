
import { costCalculator } from '../costs/costCalculator';

export const CostosPage = ({
  machineryHook
}) => {
  const {
    machinery,
    selectedMachine,
    setSelectedMachine,
    handleUpdateRates
  } = machineryHook;

  const totalHourlyCost = selectedMachine
    ? costCalculator.calculateHourlyRate(selectedMachine)
    : 0;

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { lot: 'Lote B-12', cost: 1240000, hours: 24.5 },
                { lot: 'Lote M-05', cost: 890000, hours: 18.0 },
                { lot: 'Lote C-08', cost: 580000, hours: 12.2 },
                { lot: 'Lote S-02', cost: 420000, hours: 10.0 }
              ].map((stat, idx) => (
                <div key={idx} style={{ fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>{stat.lot} ({stat.hours} hs)</span>
                    <strong>${stat.cost.toLocaleString()} COP</strong>
                  </div>
                  <div className="progress-bar-container" style={{ height: '5px', margin: 0 }}>
                    <div className="progress-bar-fill" style={{ width: `${(stat.cost / 1240000) * 100}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent-cyan))' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Costo Promedio por Hectárea</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', textAlign: 'center' }}>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PREPARACIÓN SUELO</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>$85,000 / Ha</h3>
              </div>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COSECHA MAÍZ</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>$112,000 / Ha</h3>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CostosPage;
