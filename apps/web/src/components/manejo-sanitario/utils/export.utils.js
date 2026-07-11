import * as XLSX from 'xlsx';
import { ESTADOS_LABELS, normalizarEstado } from '../../../constants/aplicaciones';

export const exportCSV = ({
  type,
  lotes = [],
  aplicaciones = [],
  monitoreos = [],
  cosechas = [],
  costos = [],
  trabajadores = [],
  auditorias = []
}) => {
  let headers = [];
  let rows = [];
  let filename = '';

  if (type === 'lotes') {
    headers = ['Codigo Interno', 'Nombre', 'Cultivo', 'Variedad', 'Area (ha)', 'Siembra', 'Estado Sanitario', 'NDVI Actual'];
    rows = lotes.map(l => [l.codigo_interno, l.nombre, l.cultivo, l.variedad, l.area_ha, l.fecha_siembra, l.estado_sanitario, l.ndvi_actual]);
    filename = 'lotes_sectores.csv';
  } else if (type === 'aplicaciones') {
    headers = ['Lote', 'Tipo Aplicacion', 'Producto Comercial', 'Dosis', 'Operario', 'Fecha', 'Costo (COP)', 'Carencia (Dias)'];
    rows = aplicaciones.map(a => {
      const targetL = lotes.find(l => l.id === a.lote_id);
      return [
        targetL?.codigo_interno || 'N/A',
        a.tipo_aplicacion,
        a.producto_comercial,
        a.dosis,
        a.operario_responsable,
        new Date(a.fecha_aplicacion).toLocaleDateString(),
        a.costo_aplicacion,
        a.periodo_carencia_dias
      ];
    });
    filename = 'aplicaciones_registro.csv';
  } else if (type === 'monitoreos') {
    headers = ['Lote', 'Responsable', 'Fecha', 'Incidencia (%)', 'Severidad (%)', 'Plagas', 'Enfermedades'];
    rows = monitoreos.map(m => {
      const targetL = lotes.find(l => l.id === m.lote_id);
      return [
        targetL?.codigo_interno || 'N/A',
        m.responsable,
        new Date(m.fecha_monitoreo).toLocaleDateString(),
        m.incidencia_pct,
        m.severidad_pct,
        m.plagas_detectadas,
        m.enfermedades_detectadas
      ];
    });
    filename = 'monitoreos_evaluaciones.csv';
  } else if (type === 'cosechas' || type === 'Cosechas') {
    headers = ['Lote', 'Fecha Programada', 'Area (ha)', 'Produccion Est. (kg)', 'Estado Carencia'];
    rows = cosechas.map(c => {
      const targetL = lotes.find(l => l.id === c.lote_id);
      return [
        targetL?.codigo_interno || 'N/A',
        c.fecha_programada,
        c.area_programada_ha,
        c.produccion_estimada_kg,
        c.estado_carencia
      ];
    });
    filename = 'planificacion_cosechas.csv';
  } else if (type === 'costos' || type === 'Costos') {
    headers = ['Lote', 'Categoria', 'Fecha', 'Descripcion', 'Costo (COP)', 'Responsable'];
    rows = costos.map(cost => {
      const targetL = lotes.find(l => l.id === cost.lote_id);
      return [
        targetL?.codigo_interno || 'N/A',
        cost.categoria,
        cost.fecha,
        cost.descripcion,
        cost.costo,
        cost.responsable
      ];
    });
    filename = 'costos_operacionales.csv';
  } else if (type === 'trabajadores' || type === 'Trabajadores') {
    headers = ['Lote', 'Nombre', 'Fecha Ingreso', 'Labor Realizada', 'Permanencia (hrs)', 'Estado'];
    rows = trabajadores.map(t => {
      const targetL = lotes.find(l => l.id === t.lote_id);
      return [
        targetL?.codigo_interno || 'N/A',
        t.nombre,
        new Date(t.fecha_ingreso).toLocaleDateString(),
        t.actividad_realizada,
        t.tiempo_permanencia_horas,
        t.estado
      ];
    });
    filename = 'registro_trabajadores.csv';
  } else {
    headers = ['Lote', 'Acción', 'Fecha'];
    rows = auditorias.map(aud => [aud.lote_codigo, aud.accion, new Date(aud.fecha).toLocaleDateString()]);
    filename = 'bitacora_auditoria.csv';
  }

  const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportAplicaciones = (formato, dataSet = [], lotes = []) => {
  const rows = dataSet.map(a => {
    const loteObj = lotes.find(l => l.id === a.lote_id);
    return {
      'Código': a.codigo_apl || a.id?.slice(0, 8).toUpperCase() || '—',
      'Estado': ESTADOS_LABELS[normalizarEstado(a.estado_programacion)] || a.estado_programacion,
      'Lote': loteObj?.codigo_interno || 'N/A',
      'Cultivo': loteObj?.cultivo || 'N/A',
      'Tipo Aplicación': a.tipo_aplicacion || '',
      'Tipo Producto': a.tipo_producto || '',
      'Producto Comercial': a.producto_comercial || '',
      'Ingrediente Activo': a.ingrediente_activo || '',
      'Dosis': a.dosis || '',
      'Volumen (L/ha)': a.volumen_aplicado || '',
      'Método': a.metodo_aplicacion || '',
      'Operario': a.operario_responsable || '',
      'Maquinaria': a.maquinaria_utilizada || '',
      'Fecha Programada': a.fecha_aplicacion ? new Date(a.fecha_aplicacion).toLocaleDateString('es-CO') : '',
      'Fecha Ejecución': a.fecha_ejecucion ? new Date(a.fecha_ejecucion).toLocaleDateString('es-CO') : '',
      'Carencia (días)': a.periodo_carencia_dias || '',
      'Registro ICA': a.registro_ica || '',
      'Observaciones': a.observaciones || '',
    };
  });

  if (formato === 'csv') {
    const headers = Object.keys(rows[0] || {});
    const csv = "\uFEFF" + [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aplicaciones_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  } else if (formato === 'excel') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aplicaciones');
    XLSX.writeFile(wb, `aplicaciones_${Date.now()}.xlsx`);
  } else if (formato === 'pdf') {
    window.print();
  }
};
