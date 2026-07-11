import React from 'react';
import { Edit3, Trash2, CreditCard } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { formatCOP as formatCurrency } from '../../utils/nominaHelpers';

export const NominasTable = React.memo(function NominasTable({
  nominas = [],
  workers = [],
  onEdit,
  onDelete
}) {
  return (
    <div className="glass-card" style={{ padding: 0 }}>
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nombre Empleado</th>
              <th>Identificación</th>
              <th>Cargo</th>
              <th>Salario Base</th>
              <th>H. Extras</th>
              <th>Descuentos</th>
              <th>Total Neto</th>
              <th>Estado</th>
              <th>Fecha Pago</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {nominas.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <EmptyState 
                    icon={CreditCard} 
                    title="No hay nóminas registradas para este periodo" 
                    description="Haz clic en 'Generar Nómina Periodo' o 'Registrar Pago Individual' para comenzar." 
                  />
                </td>
              </tr>
            ) : (
              nominas.map(n => {
                const w = n.trabajador || workers.find(work => work.id === n.trabajador_id);
                const sBase = n.salario_neto || 0;
                const hEx = n.horas_extras || 0;
                const desc = n.retenciones || 0;
                const netPay = n.total_neto || (sBase + (hEx * 15000) - desc);
                
                return (
                  <tr key={n.id}>
                    <td>{w && <Avatar worker={w} size={28} />}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {w ? `${w.nombres} ${w.apellidos}` : '—'}
                    </td>
                    <td>{w ? w.identificacion : '—'}</td>
                    <td>{w ? w.rol : '—'}</td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(sBase)}</td>
                    <td>{hEx} hrs</td>
                    <td style={{ color: desc > 0 ? 'var(--accent-red)' : 'inherit' }}>
                      {desc > 0 ? `-${formatCurrency(desc)}` : '$0'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatCurrency(netPay)}
                    </td>
                    <td>
                      <StatusBadge status={n.estado} />
                    </td>
                    <td>
                      {n.estado === 'Completado' && n.fecha_pago 
                        ? n.fecha_pago.split('-').reverse().join('/') 
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '5px 8px' }}
                          title="Editar registro" 
                          onClick={() => onEdit(n)}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
                          title="Eliminar registro" 
                          onClick={() => onDelete(n.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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

export default NominasTable;
