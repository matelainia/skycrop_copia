import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export default function InventoryMovementsHistory({
  movements = [],
  loading = false
}) {
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando historial...</div>;
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <h4 style={{ marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={16} />
        Historial de Movimientos Recientes (Kardex Audit Trail)
      </h4>

      <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
        <table className="custom-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Antes</th>
              <th>Después</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movements.length > 0 ? (
              movements.map(m => {
                const isEntrada = m.tipo === 'entrada';
                const dateStr = new Date(m.createdAt).toLocaleString();
                return (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{dateStr}</td>
                    <td style={{ fontWeight: '600', color: isEntrada ? '#16a34a' : '#ef4444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isEntrada ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {isEntrada ? 'Entrada' : 'Salida'}
                      </div>
                    </td>
                    <td style={{ fontWeight: '600' }}>{m.cantidad}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{m.antes}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{m.despues}</td>
                    <td style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{m.motivo || 'N/A'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No hay movimientos registrados para este artículo o no se ha inicializado la tabla de trazabilidad.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
