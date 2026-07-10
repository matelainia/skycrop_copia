import React from 'react';
import { Trash2 } from 'lucide-react';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { useLotsContext } from '../../context/LotsContext';

export default function MonitoringView() {
  const { lotes } = useLotsContext();
  const { monitoreos, setMonitoreos } = useMonitoringContext();

  const handleDelete = (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este monitoreo?")) {
      setMonitoreos(prev => prev.filter(m => m.id !== id));
    }
  };

  return (
    <div className="sanitary-layout-grid">
      <div className="glass-card">
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Historial de Evaluaciones de Campo</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Fecha / Responsable</th>
                <th>Tipo</th>
                <th>Incidencia / Severidad</th>
                <th>Plagas Detectadas</th>
                <th>Enfermedades</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {monitoreos.map(m => {
                const targetL = lotes.find(l => l.id === m.lote_id);
                return (
                  <tr key={m.id}>
                    <td><span style={{ fontWeight: '700', color: 'var(--primary)' }}>{targetL?.codigo_interno || 'N/A'}</span></td>
                    <td>{new Date(m.fecha_monitoreo).toLocaleDateString()} ({m.responsable})</td>
                    <td>{m.tipo_monitoreo}</td>
                    <td>Inc: {m.incidencia_pct}% | Sev: {m.severidad_pct}%</td>
                    <td>{m.plagas_detectadas || 'Ninguna'}</td>
                    <td>{m.enfermedades_detectadas || 'Ninguna'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px' }} 
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
