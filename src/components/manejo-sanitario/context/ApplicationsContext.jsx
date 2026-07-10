import React, { createContext, useContext, useEffect, useState } from 'react';
import { useApplications } from '../hooks/useApplications';
import { useLotsContext } from './LotsContext';
import { useMonitoringContext } from './MonitoringContext';
import { harvestRepository } from '../repositories/harvestRepository';
import { applicationRepository } from '../repositories/applicationRepository';
import { createHarvest } from '../types/Harvest';
import { createApplication } from '../types/Application';

const ApplicationsContext = createContext(null);

export const ApplicationsProvider = ({ children }) => {
  const { lotes, selectedLote, setLotes, weatherStation, logAudit, finishOperation } = useLotsContext();
  const monitoringContext = useMonitoringContext();

  const applications = useApplications();
  const {
    aplicaciones,
    setAplicaciones,
    newAplicacion,
    handleAddAplicacion,
    handleSavePlanificador,
    handleChangeEstadoAplicacion,
    aplicarCambioEstado,
    handleReintentarSync
  } = applications;

  // Harvest proy states
  const [cosechas, setCosechas] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_cosechas_cc');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCosechaDrawerOpen, setIsCosechaDrawerOpen] = useState(false);
  const [newCosecha, setNewCosecha] = useState({
    lote_id: '',
    fecha_programada: '',
    produccion_estimada_kg: '',
    area_programada_ha: ''
  });

  // LocalStorage sync
  useEffect(() => {
    localStorage.setItem('skycrop_cosechas_cc', JSON.stringify(cosechas));
  }, [cosechas]);

  const loadCosechasForLote = async (loteId) => {
    if (!loteId) return;
    try {
      const dbCosechas = await harvestRepository.getByLote(loteId);
      if (dbCosechas && dbCosechas.length > 0) {
        setCosechas(prev => {
          const ids = new Set(prev.map(c => String(c.id)));
          const novos = dbCosechas.filter(c => !ids.has(String(c.id))).map(c => createHarvest(c));
          return novos.length ? [...novos, ...prev] : prev;
        });
      }
    } catch (err) {
      console.warn('[Applications Context] Error loading cosechas:', err.message);
    }
  };

  // Reactively load cosechas when selected lote changes
  useEffect(() => {
    if (selectedLote?.id) {
      loadCosechasForLote(selectedLote.id);
    }
  }, [selectedLote?.id]);

  const getLoteCarenciaStatus = (loteId, targetDate = new Date()) => {
    const apps = aplicaciones.filter(a => a.lote_id === loteId && a.periodo_carencia_dias > 0);
    let isRestricted = false;
    let daysRemaining = 0;
    let activeProduct = '';

    apps.forEach(app => {
      const appDate = new Date(app.fecha_aplicacion);
      const expiryDate = new Date(appDate.getTime() + app.periodo_carencia_dias * 24 * 60 * 60 * 1000);
      const compareDate = new Date(targetDate);

      if (expiryDate > compareDate) {
        isRestricted = true;
        const diffTime = expiryDate - compareDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > daysRemaining) {
          daysRemaining = diffDays;
          activeProduct = app.producto_comercial;
        }
      }
    });

    return { isRestricted, daysRemaining, activeProduct };
  };

  const onLoteObsUpdated = (loteId, obsText) => {
    setLotes(prev => prev.map(l => {
      if (l.id === loteId) {
        return { ...l, observaciones: obsText };
      }
      return l;
    }));
  };

  const addAplicacion = () => {
    const { setCostos } = monitoringContext;
    const onCostCreated = (costEntry) => setCostos(prev => [costEntry, ...prev]);

    return handleAddAplicacion(lotes, cosechas, weatherStation, onCostCreated, onLoteObsUpdated, logAudit);
  };

  const savePlanificador = (appData, setSubTab) => {
    const { setCostos } = monitoringContext;
    const onCostCreated = (costEntry) => setCostos(prev => [costEntry, ...prev]);

    return handleSavePlanificador(appData, lotes, onCostCreated, onLoteObsUpdated, logAudit, setSubTab);
  };

  const changeEstadoAplicacion = (app, nuevoEstado) => {
    return handleChangeEstadoAplicacion(app, nuevoEstado, lotes, logAudit, onLoteObsUpdated);
  };

  const reintentarSync = (app) => {
    const { setCostos } = monitoringContext;
    const onCostCreated = (costEntry) => setCostos(prev => [costEntry, ...prev]);

    return handleReintentarSync(app, lotes, onCostCreated, onLoteObsUpdated, logAudit);
  };

  const addCosecha = () => {
    if (!newCosecha.fecha_programada) return { success: false, errors: ['La fecha programada es obligatoria.'] };

    const restrict = getLoteCarenciaStatus(newCosecha.lote_id, new Date(newCosecha.fecha_programada));
    if (restrict.isRestricted) {
      alert(`BLOQUEO OPERACIONAL:\nNo se puede planificar la cosecha. Lote bajo carencia del producto ${restrict.activeProduct} (Faltan ${restrict.daysRemaining} días).`);
      return { success: false, error: 'Blocked by active carencia.' };
    }

    const item = createHarvest({
      id: `cos-${Date.now()}`,
      lote_id: newCosecha.lote_id,
      fecha_programada: newCosecha.fecha_programada,
      produccion_estimada_kg: parseFloat(newCosecha.produccion_estimada_kg) || 0,
      area_programada_ha: parseFloat(newCosecha.area_programada_ha) || 0,
      estado_carencia: "Sin restricciones"
    });

    setCosechas(prev => [item, ...prev]);
    setIsCosechaDrawerOpen(false);

    const targetL = lotes.find(l => l.id === item.lote_id);
    logAudit(targetL?.codigo_interno || "N/A", "Cosecha planificada");

    return { success: true, item };
  };

  // Coordinated operation stopper
  const finishActiveOperation = async (loteId) => {
    const { elapsedSeconds, activeOp } = finishOperation(loteId);
    if (!activeOp) return;

    const finishedApp = createApplication({
      id: `app-${Date.now()}`,
      lote_id: loteId,
      tipo_aplicacion: activeOp.tipo_operacion === 'Aplicación' ? 'Fitosanitaria' : (activeOp.tipo_operacion || 'Fitosanitaria'),
      tipo_producto: 'Fungicida',
      producto_comercial: activeOp.producto || 'Insumo Fitosanitario',
      ingrediente_activo: 'Azoxistrobin',
      dosis: activeOp.dosis || '0.5 L/ha',
      unidad_medida: 'L',
      volumen_aplicado: 200,
      metodo_aplicacion: 'Pulverizadora foliar',
      operario_responsable: activeOp.operator || 'Pedro Gómez',
      maquinaria_utilizada: activeOp.machinery || 'Pulverizadora PU-003',
      condiciones_climaticas: `Temp: ${weatherStation.temp}°C, Viento: ${weatherStation.wind} km/h`,
      fecha_aplicacion: new Date().toISOString(),
      costo_aplicacion: 1245000,
      registro_ica: 'ICA-3456-A',
      periodo_carencia_dias: 7,
      periodo_reingreso_horas: 24,
      clasificacion_toxicologica: 'Categoría III',
      residualidad_nivel: 'Medio',
      estado_programacion: 'ejecutada'
    });

    setAplicaciones(prev => [finishedApp, ...prev]);

    try {
      const dbPayload = {
        lote_id: finishedApp.lote_id,
        tipo_aplicacion: finishedApp.tipo_aplicacion,
        tipo_producto: finishedApp.tipo_producto,
        producto_comercial: finishedApp.producto_comercial,
        ingrediente_activo: finishedApp.ingrediente_activo,
        dosis: finishedApp.dosis,
        unidad_medida: finishedApp.unidad_medida,
        volumen_aplicado: finishedApp.volumen_aplicado,
        metodo_aplicacion: finishedApp.metodo_aplicacion,
        operario_responsable: finishedApp.operario_responsable,
        maquinaria_utilizada: finishedApp.maquinaria_utilizada,
        condiciones_climaticas: finishedApp.condiciones_climaticas,
        fecha_aplicacion: finishedApp.fecha_aplicacion,
        costo_aplicacion: finishedApp.costo_aplicacion,
        registro_ica: finishedApp.registro_ica,
        periodo_carencia_dias: finishedApp.periodo_carencia_dias,
        periodo_reingreso_horas: finishedApp.periodo_reingreso_horas,
        clasificacion_toxicologica: finishedApp.clasificacion_toxicologica,
        residualidad_nivel: finishedApp.residualidad_nivel,
        estado_programacion: 'ejecutada',
        updated_by: 'Andrés Castro'
      };
      await applicationRepository.insert(dbPayload);
    } catch (sbErr) {
      console.warn('[Applications Context] Error inserting finished operation:', sbErr.message);
    }

    const { setCostos } = monitoringContext;
    const costEntry = {
      id: `cos-${Date.now()}`,
      lote_id: loteId,
      categoria: 'Aplicaciones',
      fecha: new Date().toISOString().split('T')[0],
      descripcion: `Aplicación de ${finishedApp.producto_comercial} (finalizada)`,
      costo: finishedApp.costo_aplicacion,
      responsable: finishedApp.operario_responsable
    };
    setCostos(prev => [costEntry, ...prev]);

    onLoteObsUpdated(loteId, `Aplicación realizada: ${finishedApp.producto_comercial} (Carencia: ${finishedApp.periodo_carencia_dias}d).`);

    const formatDuration = (seconds) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    logAudit(selectedLote?.codigo_interno || "N/A", `Finalización de aplicación: ${finishedApp.producto_comercial} (Duración: ${formatDuration(elapsedSeconds)})`);
  };

  const aplicarCambioEstadoWrapped = (app, nuevoEstado) => {
    return aplicarCambioEstado(app, nuevoEstado, lotes, logAudit, onLoteObsUpdated);
  };

  const value = {
    ...applications,
    aplicarCambioEstado: aplicarCambioEstadoWrapped,
    cosechas,
    setCosechas,
    isCosechaDrawerOpen,
    setIsCosechaDrawerOpen,
    newCosecha,
    setNewCosecha,
    loadCosechasForLote,
    getLoteCarenciaStatus,
    addAplicacion,
    savePlanificador,
    changeEstadoAplicacion,
    reintentarSync,
    addCosecha,
    finishActiveOperation
  };

  return (
    <ApplicationsContext.Provider value={value}>
      {children}
    </ApplicationsContext.Provider>
  );
};

export const useApplicationsContext = () => {
  const context = useContext(ApplicationsContext);
  if (!context) {
    throw new Error('useApplicationsContext must be used within an ApplicationsProvider');
  }
  return context;
};
