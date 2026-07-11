import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useLotsContext } from '../../context/LotsContext';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { exportCSV } from '../../utils/export.utils';

export default function ReportsView() {
  const { lotes, auditorias } = useLotsContext();
  const { aplicaciones, cosechas } = useApplicationsContext();
  const { monitoreos, costos, trabajadores } = useMonitoringContext();

  const handleExport = (type) => {
    exportCSV({
      type,
      lotes,
      aplicaciones,
      monitoreos,
      cosechas,
      costos,
      trabajadores,
      auditorias
    });
  };

  return (
    <div className="sanitary-layout-grid">
      <div className="glass-card">
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Consola de Reportes ICA y Trazabilidad</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => handleExport('aplicaciones')} 
            style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FileSpreadsheet size={16} /><span>Exportar Registro ICA (CSV)</span>
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FileText size={16} /><span>Imprimir Reporte PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
