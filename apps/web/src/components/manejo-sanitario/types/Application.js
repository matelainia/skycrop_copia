import { normalizarEstado } from '../../../constants/aplicaciones';

export const createApplication = (data = {}) => {
  return {
    id: data.id || '',
    lote_id: data.lote_id || '',
    tipo_aplicacion: data.tipo_aplicacion || 'Fitosanitaria',
    tipo_producto: data.tipo_producto || 'Fungicida',
    producto_comercial: (data.producto_comercial || '').trim(),
    ingrediente_activo: (data.ingrediente_activo || '').trim() || 'N/A',
    dosis: data.dosis || 'N/A',
    unidad_medida: data.unidad_medida || 'L',
    volumen_aplicado: parseFloat(data.volumen_aplicado) || 0,
    metodo_aplicacion: data.metodo_aplicacion || 'Foliar con tractor',
    operario_responsable: data.operario_responsable || 'Andrés Castro',
    maquinaria_utilizada: data.maquinaria_utilizada || 'Manual',
    condiciones_climaticas: data.condiciones_climaticas || '',
    fecha_aplicacion: data.fecha_aplicacion || new Date().toISOString(),
    fecha_ejecucion: data.fecha_ejecucion || null,
    costo_aplicacion: parseFloat(data.costo_aplicacion) || 0,
    registro_ica: data.registro_ica || '',
    periodo_carencia_dias: parseInt(data.periodo_carencia_dias, 10) || 0,
    periodo_reingreso_horas: parseInt(data.periodo_reingreso_horas, 10) || 0,
    clasificacion_toxicologica: data.clasificacion_toxicologica || 'Categoría III',
    residualidad_nivel: data.residualidad_nivel || 'Medio',
    estado_programacion: normalizarEstado(data.estado_programacion),
    codigo_apl: data.codigo_apl || ''
  };
};
