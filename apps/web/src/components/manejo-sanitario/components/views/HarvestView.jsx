import React from 'react';
import { Trash2 } from 'lucide-react';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { useLotsContext } from '../../context/LotsContext';

export default function HarvestView() {
  const { lotes } = useLotsContext();
  const { cosechas, setCosechas, getLoteCarenciaStatus } = useApplicationsContext();

  const handleDelete = (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta cosecha planificada?")) {
      setCosechas(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="sanitary-layout-grid">
      <div className="glass-card">
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Planificación de Cosecha & Control de Inocuidad</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Cultivo</th>
                <th>Fecha Cosecha</th>
                <th>Área Programada</th>
                <th>Producción Estimada</th>
                <th>Estado de Inocuidad</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {cosechas.map(c => {
                const targetL = lotes.find(l => l.id === c.lote_id);
                const carencia = getLoteCarenciaStatus(c.lote_id, new Date(c.fecha_programada));
                return (
                  <tr key={c.id}>
                    <td><span style={{ fontWeight: '700', color: 'var(--primary)' }}>{targetL?.codigo_interno || 'N/A'}</span></td>
                    <td>{targetL?.cultivo || '—'} {targetL?.variedad ? `(${targetL.variedad})` : ''}</td>
                    <td>{c.fecha_programada}</td>
                    <td>{c.area_programada_ha} ha</td>
                    <td>{c.produccion_estimada_kg.toLocaleString()} kg</td>
                    <td>
                      {carencia.isRestricted ? (
                        <span className="badge badge-red" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          Carencia Activa ({carencia.daysRemaining}d)
                        </span>
                      ) : (
                        <span className="badge badge-green" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          Sin restricciones
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px' }} 
                        onClick={() => handleDelete(c.id)}
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
