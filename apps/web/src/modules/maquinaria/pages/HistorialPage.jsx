import { formatDateTime, formatDateShort } from '../utils/formatters';

export const HistorialPage = ({
  machineryHook,
  operationHook
}) => {
  const { machinery } = machineryHook;
  const {
    jornadas,
    activeMachineId,
    setActiveMachineId,
    activeMachine
  } = operationHook;

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Historial Histórico y Trazabilidad de Flota</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px' }}>Filtrar por Equipo:</span>
          <select
            className="input-glass select-glass"
            style={{ width: '200px', padding: '4px 10px', fontSize: '13px' }}
            value={activeMachineId || ''}
            onChange={e => setActiveMachineId(e.target.value)}
          >
            {machinery.map(m => (
              <option key={m.id} value={m.id}>{m.codigoId} - {m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {activeMachine ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          
          {/* Left detail card */}
          <div className="glass-card primary-edge" style={{ padding: '20px', alignSelf: 'flex-start' }}>
            <img
              src={activeMachine.photoUrl}
              alt={activeMachine.name}
              style={{ width: '100%', height: '150px', borderRadius: '12px', objectFit: 'cover', marginBottom: '14px' }}
            />
            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>{activeMachine.name}</h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Código: {activeMachine.codigoId} · Categoría: {activeMachine.type}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div>Horas Totales: <strong>{activeMachine.hoursOfOperation.toLocaleString()} h</strong></div>
              <div>Último Mto: <strong>{formatDateShort(activeMachine.lastMaintenance)}</strong></div>
              <div>Próximo Mto: <strong>{formatDateShort(activeMachine.nextMaintenance)}</strong></div>
              <div>Consumo: <strong>{activeMachine.fuelConsumption}</strong></div>
              <div>Costo Operativo Base: <strong style={{ color: 'var(--primary)' }}>${(activeMachine.costOperator + activeMachine.costFuel + activeMachine.costMaintenance + activeMachine.costDepreciation).toFixed(2)}/h</strong></div>
            </div>
          </div>

          {/* Timeline view */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700' }}>Línea de Tiempo Operacional</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '20px', marginLeft: '10px' }}>
              {jornadas.filter(j => j.maquinariaId === activeMachine.id).map(j => (
                <div key={j.id} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <span style={{
                    position: 'absolute',
                    left: '-25px',
                    top: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: j.status === 'En Progreso' ? 'var(--primary)' : 'var(--text-muted)'
                  }} />

                  <div className="glass-card" style={{ padding: '14px', background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', background: j.status === 'En Progreso' ? 'var(--primary-light)' : '#e5e7eb', color: j.status === 'En Progreso' ? 'var(--primary)' : '#4b5563', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                        {j.status === 'En Progreso' ? 'Labor Iniciada' : 'Labor Finalizada'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDateTime(j.startTime)}</span>
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      <div>Operador: <strong>{j.operator}</strong></div>
                      <div>Labor: <strong>{j.activity}</strong> en <strong>{j.lot}</strong></div>
                      {j.status === 'Finalizada' && (
                        <div style={{ marginTop: '6px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>Horas: <strong>{j.calculatedHours.toFixed(1)} h</strong></div>
                          <div>Combustible: <strong>{j.calculatedFuelConsumption.toFixed(1)} L</strong></div>
                          <div>Costo labor: <strong style={{ color: 'var(--primary)' }}>${j.calculatedCost.toLocaleString()}</strong></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {jornadas.filter(j => j.maquinariaId === activeMachine.id).length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                  No hay registros operativos anteriores para este equipo.
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando información del equipo...
        </div>
      )}
    </div>
  );
};

export default HistorialPage;
