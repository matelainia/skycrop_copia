import React, { useMemo } from 'react';
import { Trash2, ClipboardList } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { getHorasDeJornal } from '../../utils/laborHelpers';

export const HistorialTable = React.memo(function HistorialTable({
  labores = [],
  workers = [],
  cuadrillas = [],
  search = '',
  type = 'Todos',
  dateStart = '',
  dateEnd = '',
  onUnarchiveLabor,
  onDeleteLabor
}) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const filteredRows = useMemo(() => {
    const historyRows = [];
    
    labores.forEach(labor => {
      if (labor.estado !== 'Archivada') return;

      let workersForLabor = [];
      if (labor.asignacion === 'cuadrilla') {
        const cuadrilla = cuadrillas.find(c => c.id === labor.cuadrillaId);
        if (cuadrilla) {
          workersForLabor = cuadrilla.miembros
            .map(workerId => workers.find(w => w.id === workerId))
            .filter(Boolean);
        }
      } else {
        workersForLabor = (labor.trabajadoresIds || [])
          .map(workerId => workers.find(w => w.id === workerId))
          .filter(Boolean);
      }

      const laborText = `${labor.titulo} ${labor.descripcion || ''} ${labor.lote || ''} ${labor.tipo}`.toLowerCase();
      const jVal = labor.jornal !== undefined && labor.jornal !== null ? Number(labor.jornal) : 1.0;
      const hVal = getHorasDeJornal(jVal);

      if (workersForLabor.length === 0) {
        historyRows.push({
          key: labor.id,
          laborId: labor.id,
          fecha: labor.fecha,
          trabajadorName: 'Sin asignar',
          trabajadorObj: null,
          lote: labor.lote || '—',
          actividad: labor.titulo,
          descripcion: labor.descripcion,
          jornal: jVal,
          horas: hVal,
          tipo: labor.tipo,
          searchText: `${laborText} sin asignar`
        });
      } else {
        workersForLabor.forEach(w => {
          const workerName = `${w.nombres} ${w.apellidos}`;
          historyRows.push({
            key: `${labor.id}-${w.id}`,
            laborId: labor.id,
            fecha: labor.fecha,
            trabajadorName: workerName,
            trabajadorObj: w,
            lote: labor.lote || '—',
            actividad: labor.titulo,
            descripcion: labor.descripcion,
            jornal: jVal,
            horas: hVal,
            tipo: labor.tipo,
            searchText: `${laborText} ${workerName} ${w.identificacion} ${w.rol}`.toLowerCase()
          });
        });
      }
    });

    const filtered = historyRows.filter(row => {
      if (search.trim()) {
        const query = search.toLowerCase();
        if (!row.searchText.includes(query)) return false;
      }
      if (dateStart && row.fecha < dateStart) return false;
      if (dateEnd && row.fecha > dateEnd) return false;
      if (type !== 'Todos' && row.tipo !== type) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const dateCompare = b.fecha.localeCompare(a.fecha);
      if (dateCompare !== 0) return dateCompare;
      return a.trabajadorName.localeCompare(b.trabajadorName);
    });

    return filtered;
  }, [labores, workers, cuadrillas, search, type, dateStart, dateEnd]);

  return (
    <div className="glass-card" style={{ padding: 0 }}>
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Trabajador</th>
              <th>Lote / Sector</th>
              <th>Actividad Realizada</th>
              <th>Horas Trabajadas</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState 
                    icon={ClipboardList} 
                    title="No se encontraron actividades archivadas" 
                    description={
                      labores.some(l => l.estado === 'Archivada')
                        ? 'Ninguna actividad coincide con los filtros aplicados.'
                        : 'Las labores aparecerán aquí una vez que finalices el día.'
                    } 
                  />
                </td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.key}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDate(row.fecha)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.trabajadorObj ? (
                        <>
                          <Avatar worker={row.trabajadorObj} size={24} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{row.trabajadorName}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.trabajadorObj.rol}</div>
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.trabajadorName}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{row.lote}</td>
                  <td>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{row.actividad}</strong>
                      <span className="badge badge-green" style={{ fontSize: 10, marginLeft: 8, background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px' }}>{row.tipo}</span>
                      {row.descripcion && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          {row.descripcion}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {row.jornal.toFixed(2)} ({row.horas} hrs)
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '5px 8px', fontSize: 11 }}
                        title="Desarchivar labor" 
                        onClick={() => onUnarchiveLabor(row.laborId, 'Completada')}
                      >
                        Desarchivar
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
                        title="Eliminar labor permanentemente" 
                        onClick={() => onDeleteLabor(row.laborId)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default HistorialTable;
