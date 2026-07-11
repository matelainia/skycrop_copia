import React from 'react';
import { Trash2, ClipboardList } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';

export const RegistroTable = React.memo(function RegistroTable({
  registros = [],
  workers = [],
  cursos = [],
  onShowCertificate,
  onDeleteRegistro
}) {
  return (
    <div className="glass-card" style={{ padding: 0 }}>
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nombre Empleado</th>
              <th>ID</th>
              <th>Rol</th>
              <th>Nombre Capacitación</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Puntuación</th>
              <th>Estado</th>
              <th>Certificado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <EmptyState 
                    icon={ClipboardList} 
                    title="No se encontraron registros de capacitación" 
                    description="Asegúrate de ajustar los filtros o registra una capacitación para comenzar." 
                  />
                </td>
              </tr>
            ) : (
              registros.map(r => {
                const w = workers.find(work => work.id === r.trabajador_id);
                const c = cursos.find(cur => cur.id === r.curso_id);
                
                return (
                  <tr key={r.id}>
                    <td>{w && <Avatar worker={w} size={28} />}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {w ? `${w.nombres} ${w.apellidos}` : '—'}
                    </td>
                    <td>{w ? w.identificacion : '—'}</td>
                    <td>{w ? w.rol : '—'}</td>
                    <td style={{ fontWeight: 500 }}>{c ? c.nombre : '—'}</td>
                    <td>{c ? c.tipo : '—'}</td>
                    <td>{r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                    <td>{r.resultado}</td>
                    <td>
                      <StatusBadge status={r.estado} />
                    </td>
                    <td>
                      {r.estado === 'Completada' ? (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '3px 8px', fontSize: 11, color: 'var(--primary)' }}
                          onClick={() => onShowCertificate(r)}
                        >
                          (Ver)
                        </button>
                      ) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => onDeleteRegistro(r.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default RegistroTable;
