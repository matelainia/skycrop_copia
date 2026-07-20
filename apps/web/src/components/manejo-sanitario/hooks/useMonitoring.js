import { useState, useEffect, useCallback } from 'react';
import { createMonitoring } from '../types/Monitoring';
import { monitoringRepository } from '../repositories/monitoringRepository';
import { agronomyRepository } from '../repositories/agronomyRepository';

/**
 * Evalúa si un conjunto de valores supera algún umbral económico.
 * @param {Object} valoresEvaluacion
 * @param {number} incidenciaPct
 * @param {Array}  umbrales
 * @returns {Array} Lista de alertas disparadas
 */
function evaluarUmbrales(valoresEvaluacion, incidenciaPct, umbrales = []) {
  const alertas = [];
  const todosLosValores = { ...valoresEvaluacion, incidencia_pct: incidenciaPct };

  for (const umbral of umbrales) {
    const valorActual = todosLosValores[umbral.variable_clave];
    if (valorActual === undefined || valorActual === null) continue;

    const num = parseFloat(valorActual);
    let disparado = false;
    switch (umbral.operador) {
      case '>':  disparado = num > umbral.valor_critico; break;
      case '<':  disparado = num < umbral.valor_critico; break;
      case '>=': disparado = num >= umbral.valor_critico; break;
      case '<=': disparado = num <= umbral.valor_critico; break;
      case '=':  disparado = num === umbral.valor_critico; break;
    }

    if (disparado) {
      alertas.push({
        nivel_riesgo: umbral.nivel_riesgo,
        mensaje: umbral.mensaje_alerta,
        recomendacion: umbral.recomendacion_inmediata
      });
    }
  }
  return alertas;
}

/**
 * Calcula automáticamente la incidencia porcentual si el protocolo
 * contiene las claves 'frutos_evaluados' / 'hojas_evaluadas' y su
 * contraparte 'frutos_enfermos' / 'hojas_infectadas'.
 */
function calcularIncidencia(valoresEvaluacion) {
  const evaluados = valoresEvaluacion.frutos_evaluados
    ?? valoresEvaluacion.hojas_evaluadas
    ?? valoresEvaluacion.frutos_muestreados;
  const enfermos = valoresEvaluacion.frutos_enfermos
    ?? valoresEvaluacion.hojas_infectadas
    ?? valoresEvaluacion.frutos_brocados;

  if (evaluados && enfermos !== undefined && parseFloat(evaluados) > 0) {
    return parseFloat(((parseFloat(enfermos) / parseFloat(evaluados)) * 100).toFixed(2));
  }
  return null;
}

const ESTADO_INICIAL = {
  lote_id: '',
  objeto_evaluacion_id: '',
  protocolo_version_id: '',
  tipo_monitoreo: 'Sanitario',
  responsable: '',
  valores_evaluacion: {},
  incidencia_pct: 0,
  severidad_pct: 0,
  humedad_pct: '',
  temperatura_c: '',
  observaciones: ''
};

export const useMonitoring = () => {
  // ── Estado: lista de monitoreos (persistidos en localStorage + DB)
  const [monitoreos, setMonitoreos] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_monitoreos_cc');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // ── Estado: UI del drawer
  const [isMonDrawerOpen, setIsMonDrawerOpen] = useState(false);

  // ── Estado: datos del formulario de nueva evaluación
  const [newMonitoreo, setNewMonitoreo] = useState(ESTADO_INICIAL);

  // ── Estado: formulario dinámico (objetos + protocolo del lote seleccionado)
  const [formularioMonitoreo, setFormularioMonitoreo] = useState(null);
  const [formularioCargando, setFormularioCargando] = useState(false);
  const [formularioError, setFormularioError] = useState(null);

  // ── Estado: objeto de evaluación seleccionado con su protocolo
  const [objetoSeleccionado, setObjetoSeleccionadoInternal] = useState(null);

  // ── Estado: alertas de umbral en tiempo real
  const [alertasUmbral, setAlertasUmbral] = useState([]);

  // Persist monitoreos a localStorage
  useEffect(() => {
    localStorage.setItem('skycrop_monitoreos_cc', JSON.stringify(monitoreos));
  }, [monitoreos]);

  // ── Al cambiar el lote en el formulario: cargar el formulario dinámico
  useEffect(() => {
    if (!newMonitoreo.lote_id) {
      setFormularioMonitoreo(null);
      setObjetoSeleccionadoInternal(null);
      return;
    }
    cargarFormulario(newMonitoreo.lote_id);
  }, [newMonitoreo.lote_id]);

  // ── Al cambiar el objeto seleccionado: resetear valores y alertas
  useEffect(() => {
    setNewMonitoreo(prev => ({
      ...prev,
      objeto_evaluacion_id: objetoSeleccionado?.id || '',
      protocolo_version_id: objetoSeleccionado?.protocolo?.id || '',
      valores_evaluacion: {}
    }));
    setAlertasUmbral([]);
  }, [objetoSeleccionado?.id]);

  /**
   * Carga el formulario dinámico completo para un lote.
   * UNA sola llamada al backend.
   */
  const cargarFormulario = useCallback(async (loteId) => {
    setFormularioCargando(true);
    setFormularioError(null);
    try {
      const data = await agronomyRepository.getFormularioMonitoreo(loteId);
      setFormularioMonitoreo(data);
      // Si sólo hay un objeto, pre-seleccionarlo
      if (data.objetos?.length === 1) {
        setObjetoSeleccionadoInternal(data.objetos[0]);
      } else {
        setObjetoSeleccionadoInternal(null);
      }
    } catch (err) {
      console.warn('[useMonitoring] Error cargando formulario:', err.message);
      setFormularioError('No se pudo cargar el formulario para este lote.');
      setFormularioMonitoreo(null);
    } finally {
      setFormularioCargando(false);
    }
  }, []);

  /**
   * Seleccionar un objeto de evaluación del formulario.
   */
  const seleccionarObjeto = useCallback((objeto) => {
    setObjetoSeleccionadoInternal(objeto);
  }, []);

  /**
   * Actualizar un valor de evaluación individual y re-evaluar umbrales.
   */
  const actualizarValorEvaluacion = useCallback((clave, valor) => {
    setNewMonitoreo(prev => {
      const nuevosValores = { ...prev.valores_evaluacion, [clave]: valor };

      // Auto-calcular incidencia si aplica
      const incidenciaCalculada = calcularIncidencia(nuevosValores);

      // Evaluar umbrales en tiempo real
      const incidencia = incidenciaCalculada ?? parseFloat(prev.incidencia_pct) ?? 0;
      if (objetoSeleccionado?.umbrales) {
        const alertas = evaluarUmbrales(nuevosValores, incidencia, objetoSeleccionado.umbrales);
        setAlertasUmbral(alertas);
      }

      return {
        ...prev,
        valores_evaluacion: nuevosValores,
        incidencia_pct: incidenciaCalculada ?? prev.incidencia_pct
      };
    });
  }, [objetoSeleccionado]);

  /**
   * Carga los monitoreos de la base de datos para un lote.
   */
  const loadMonitoringForLote = async (loteId) => {
    if (!loteId) return;
    try {
      const dbMons = await monitoringRepository.getByLote(loteId);
      if (dbMons && dbMons.length > 0) {
        setMonitoreos(prev => {
          const ids = new Set(prev.map(m => String(m.id)));
          const novos = dbMons.filter(m => !ids.has(String(m.id))).map(m => createMonitoring(m));
          return novos.length ? [...novos, ...prev] : prev;
        });
      }
    } catch (err) {
      console.warn('[useMonitoring] Error loading monitoreos:', err.message);
    }
  };

  /**
   * Guardar la evaluación: validar, persistir en Supabase, actualizar estado local.
   */
  const handleAddMonitoreo = async (lotes, selectedLote, onLoteStatusUpdated, onAuditLogged) => {
    if (!newMonitoreo.responsable?.trim()) {
      return { success: false, errors: ['El responsable es obligatorio.'] };
    }
    if (!newMonitoreo.objeto_evaluacion_id) {
      return { success: false, errors: ['Debe seleccionar un objeto de evaluación.'] };
    }

    // Calcular incidencia automática si no fue provista
    const incidenciaFinal = calcularIncidencia(newMonitoreo.valores_evaluacion)
      ?? parseFloat(newMonitoreo.incidencia_pct) ?? 0;

    // Derivar nombre de plaga/enfermedad para campos legacy (compatibilidad)
    const nombreObjeto = objetoSeleccionado?.nombre_comun || '';
    const categoria = objetoSeleccionado?.categoria || '';
    const esEnfermedad = categoria.toLowerCase().includes('enfermedad');
    const esInsecto = ['Insecto', 'Ácaro', 'Nematodo', 'Molusco', 'Mamífero'].includes(categoria);

    const dbPayload = {
      lote_id:                newMonitoreo.lote_id,
      objeto_evaluacion_id:   newMonitoreo.objeto_evaluacion_id,
      protocolo_version_id:   newMonitoreo.protocolo_version_id || null,
      tipo_monitoreo:         newMonitoreo.tipo_monitoreo,
      responsable:            newMonitoreo.responsable,
      valores_evaluacion:     newMonitoreo.valores_evaluacion,
      incidencia_pct:         incidenciaFinal,
      severidad_pct:          parseFloat(newMonitoreo.severidad_pct) || 0,
      humedad_pct:            newMonitoreo.humedad_pct ? parseFloat(newMonitoreo.humedad_pct) : null,
      temperatura_c:          newMonitoreo.temperatura_c ? parseFloat(newMonitoreo.temperatura_c) : null,
      plagas_detectadas:      esInsecto ? nombreObjeto : null,
      enfermedades_detectadas: esEnfermedad ? nombreObjeto : null,
      observaciones:          newMonitoreo.observaciones
    };

    try {
      const saved = await monitoringRepository.create(dbPayload);
      const item = createMonitoring({ ...saved, id: saved.id || `mon-${Date.now()}` });
      setMonitoreos(prev => [item, ...prev]);

      // Calcular salud del lote
      let health = 'excelente';
      if (incidenciaFinal > 15) health = 'bajo';
      else if (incidenciaFinal > 5) health = 'regular';
      else if (incidenciaFinal > 1) health = 'bueno';

      if (onLoteStatusUpdated) {
        onLoteStatusUpdated(item.lote_id, health, item.severidad_pct, nombreObjeto, incidenciaFinal);
      }

      const targetL = lotes.find(l => l.id === item.lote_id);
      if (onAuditLogged) {
        onAuditLogged(targetL?.codigo_interno || 'N/A', `Evaluación registrada: ${nombreObjeto} | Incidencia: ${incidenciaFinal}%`);
      }

      // Resetear formulario
      setNewMonitoreo(ESTADO_INICIAL);
      setObjetoSeleccionadoInternal(null);
      setFormularioMonitoreo(null);
      setAlertasUmbral([]);
      setIsMonDrawerOpen(false);

      return { success: true, item, alertas: alertasUmbral };
    } catch (err) {
      console.error('[handleAddMonitoreo] Error guardando evaluación:', err);
      return { success: false, errors: [err.message] };
    }
  };

  return {
    monitoreos,
    isMonDrawerOpen,
    newMonitoreo,
    formularioMonitoreo,
    formularioCargando,
    formularioError,
    objetoSeleccionado,
    alertasUmbral,
    setMonitoreos,
    setIsMonDrawerOpen,
    setNewMonitoreo,
    seleccionarObjeto,
    actualizarValorEvaluacion,
    loadMonitoringForLote,
    handleAddMonitoreo
  };
};
