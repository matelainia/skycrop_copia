import { useState, useEffect, useCallback } from 'react';
import { applicationRepository } from '../repositories/applicationRepository';
import { geeRepository } from '../repositories/geeRepository';
import { createApplication } from '../types/Application';
import { validateApplication, checkHarvestConflict } from '../validators/application.validator';
import { normalizarEstado, TRANSICIONES_VALIDAS, ESTADOS_APLICACION } from '../../../constants/aplicaciones';

export const useApplications = () => {
  const [aplicaciones, setAplicaciones] = useState([]);
  const [aplicacionesLoading, setAplicacionesLoading] = useState(false);
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);
  const [aplicacionesMode, setAplicacionesMode] = useState('list');
  const [activeAplicacionesTab, setActiveAplicacionesTab] = useState('activas');
  const [confirmEjecutadaModal, setConfirmEjecutadaModal] = useState({ open: false, app: null });

  const [newAplicacion, setNewAplicacion] = useState({
    lote_id: '',
    tipo_aplicacion: 'Fitosanitaria',
    tipo_producto: 'Fungicida',
    producto_comercial: '',
    ingrediente_activo: '',
    dosis: '',
    unidad_medida: 'L',
    volumen_aplicado: '',
    metodo_aplicacion: 'Foliar con tractor',
    operario_responsable: '',
    maquinaria_utilizada: '',
    condiciones_climaticas: '',
    costo_aplicacion: '',
    registro_ica: '',
    periodo_carencia_dias: 7,
    periodo_reingreso_horas: 24,
    clasificacion_toxicologica: 'Categoría III',
    residualidad_nivel: 'Medio'
  });

  const loadApplications = async () => {
    setAplicacionesLoading(true);
    try {
      const dbApps = await applicationRepository.getAll();
      setAplicaciones(dbApps.map(a => createApplication(a)));
    } catch (err) {
      console.warn('[Applications Hook] Error loading applications:', err.message);
      setAplicaciones([]);
    } finally {
      setAplicacionesLoading(false);
    }
  };

  const handleAddAplicacion = (lotes, cosechas, weatherStation, onCostCreated, onLoteObsUpdated, onAuditLogged) => {
    const val = validateApplication(newAplicacion);
    if (!val.isValid) return { success: false, errors: val.errors };

    const targetL = lotes.find(l => l.id === newAplicacion.lote_id);
    const plannedHarvests = cosechas.filter(c => c.lote_id === newAplicacion.lote_id);
    const carenciaDays = Number(newAplicacion.periodo_carencia_dias);

    // Carencia validation rules
    const conf = checkHarvestConflict(carenciaDays, plannedHarvests);
    if (conf.conflict && carenciaDays > 0) {
      const proceed = window.confirm(
        `¡ALERTA REGULATORIA DE CARENCIA!\nExiste una cosecha programada antes del vencimiento del periodo de carencia (${carenciaDays} días) de este producto.\n¿Registrar la aplicación?`
      );
      if (!proceed) return { success: false, error: 'Cancelled by user due to carencia conflict.' };
    }

    const item = createApplication({
      id: `app-${Date.now()}`,
      lote_id: newAplicacion.lote_id,
      tipo_aplicacion: newAplicacion.tipo_aplicacion,
      tipo_producto: newAplicacion.tipo_producto,
      producto_comercial: newAplicacion.producto_comercial,
      ingrediente_activo: newAplicacion.ingrediente_activo,
      dosis: newAplicacion.dosis,
      unidad_medida: newAplicacion.unidad_medida,
      volumen_aplicado: parseFloat(newAplicacion.volumen_aplicado) || 0,
      metodo_aplicacion: newAplicacion.metodo_aplicacion,
      operario_responsable: newAplicacion.operario_responsable || 'Andrés Castro',
      maquinaria_utilizada: newAplicacion.maquinaria_utilizada || 'Manual',
      condiciones_climaticas: `Temp: ${weatherStation.temp}°C, Viento: ${weatherStation.wind} km/h`,
      fecha_aplicacion: new Date().toISOString(),
      costo_aplicacion: parseFloat(newAplicacion.costo_aplicacion) || 0,
      registro_ica: newAplicacion.registro_ica,
      periodo_carencia_dias: carenciaDays,
      periodo_reingreso_horas: Number(newAplicacion.periodo_reingreso_horas),
      clasificacion_toxicologica: newAplicacion.clasificacion_toxicologica,
      residualidad_nivel: newAplicacion.residualidad_nivel
    });

    setAplicaciones(prev => [item, ...prev]);

    // Side effect triggers (Costs)
    if (onCostCreated) {
      onCostCreated({
        id: `cos-${Date.now()}`,
        lote_id: item.lote_id,
        categoria: "Aplicaciones",
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Aplicación de ${item.producto_comercial}`,
        costo: item.costo_aplicacion,
        responsable: item.operario_responsable
      });
    }

    // Side effect triggers (Lote observations)
    if (onLoteObsUpdated) {
      onLoteObsUpdated(
        item.lote_id,
        `Aplicación realizada: ${item.producto_comercial} (Carencia: ${item.periodo_carencia_dias}d).`
      );
    }

    setIsAppDrawerOpen(false);
    if (onAuditLogged) {
      onAuditLogged(targetL?.codigo_interno || "N/A", `Registro de aplicación: ${item.producto_comercial}`);
    }

    return { success: true, item };
  };

  const handleSavePlanificador = async (appData, lotes, onCostCreated, onLoteObsUpdated, onAuditLogged, setSubTab) => {
    const localId = appData.id || `app-${Date.now()}`;
    const normalizedApp = createApplication({
      ...appData,
      id: localId,
      _syncing: true,
      _sync_error: false
    });

    setAplicaciones(prev => [normalizedApp, ...prev]);

    const dbPayload = {
      lote_id: normalizedApp.lote_id,
      tipo_aplicacion: normalizedApp.tipo_aplicacion,
      tipo_producto: normalizedApp.tipo_producto,
      producto_comercial: normalizedApp.producto_comercial,
      ingrediente_activo: normalizedApp.ingrediente_activo,
      dosis: normalizedApp.dosis,
      volumen_aplicado: normalizedApp.volumen_aplicado ?? null,
      metodo_aplicacion: normalizedApp.metodo_aplicacion,
      operario_responsable: normalizedApp.operario_responsable,
      maquinaria_utilizada: normalizedApp.maquinaria_utilizada ?? null,
      fecha_aplicacion: normalizedApp.fecha_aplicacion,
      costo_aplicacion: normalizedApp.costo_aplicacion ?? 0,
      periodo_carencia_dias: normalizedApp.periodo_carencia_dias ?? null,
      estado_programacion: normalizedApp.estado_programacion,
      updated_by: 'Andrés Castro'
    };

    try {
      const savedApp = await applicationRepository.insert(dbPayload);
      if (!savedApp) throw new Error('No data received from DB insert');

      const finalApp = createApplication({
        ...savedApp,
        _syncing: false
      });

      setAplicaciones(prev => prev.map(a => a.id === localId ? finalApp : a));

      // Side effect triggers (Costs)
      if (finalApp.costo_aplicacion > 0 && onCostCreated) {
        onCostCreated({
          id: `cos-plan-${finalApp.id}`,
          lote_id: finalApp.lote_id,
          categoria: 'Aplicaciones',
          fecha: finalApp.fecha_aplicacion?.split('T')[0] || new Date().toISOString().split('T')[0],
          descripcion: `Aplicación planificada: ${finalApp.producto_comercial}`,
          costo: finalApp.costo_aplicacion,
          responsable: finalApp.operario_responsable
        });
      }

      // Side effect triggers (Lotes)
      if (onLoteObsUpdated) {
        onLoteObsUpdated(
          finalApp.lote_id,
          `Aplicación programada: ${finalApp.producto_comercial}.`
        );
      }

      const targetL = lotes.find(l => l.id === finalApp.lote_id);
      if (onAuditLogged) {
        onAuditLogged(targetL?.codigo_interno || 'N/A', `Aplicación planificada: ${finalApp.producto_comercial} [${finalApp.codigo_apl || '...'}]`);
      }

    } catch (err) {
      console.error('[INSERT sync error] Failed to save application to DB:', err.message);
      setAplicaciones(prev => prev.map(a =>
        a.id === localId ? { ...a, _syncing: false, _sync_error: true } : a
      ));
    }

    setAplicacionesMode('list');
    if (setSubTab) setSubTab('aplicaciones');
  };

  const aplicarCambioEstado = useCallback(async (app, nuevoEstado, lotes, onAuditLogged, onLoteObsUpdated) => {
    const ahora = new Date().toISOString();
    const estadoAnterior = normalizarEstado(app.estado_programacion);
    const targetL = lotes.find(l => l.id === app.lote_id);

    setAplicaciones(prev => prev.map(a =>
      a.id === app.id
        ? {
          ...a,
          estado_programacion: nuevoEstado,
          _syncing: true,
          _sync_error: false,
          ...(nuevoEstado === ESTADOS_APLICACION.EJECUTADA && { fecha_ejecucion: ahora })
        }
        : a
    ));

    try {
      const payload = {
        estado_programacion: nuevoEstado,
        updated_by: 'Andrés Castro'
      };
      if (nuevoEstado === ESTADOS_APLICACION.EJECUTADA) payload.fecha_ejecucion = ahora;

      const updatedApp = await applicationRepository.update(app.id, payload);
      if (!updatedApp) throw new Error('No data received from DB update');

      const finalApp = createApplication({
        ...updatedApp,
        _syncing: false,
        _sync_error: false
      });

      setAplicaciones(prev => prev.map(a => a.id === app.id ? finalApp : a));

      if (onAuditLogged) {
        onAuditLogged(
          targetL?.codigo_interno || 'N/A',
          `Estado de "${app.producto_comercial}" cambiado: ${estadoAnterior} → ${nuevoEstado}`
        );
      }

      if (nuevoEstado === ESTADOS_APLICACION.EJECUTADA && onLoteObsUpdated) {
        onLoteObsUpdated(
          app.lote_id,
          `Aplicación ejecutada: ${app.producto_comercial} (Carencia: ${app.periodo_carencia_dias}d).`
        );
      }

      // Fire and forget audit API
      geeRepository.auditApplicationState(app.id).catch(() => {});

    } catch (err) {
      console.error('[Sync Error] Failed to update application status:', err.message);
      setAplicaciones(prev => prev.map(a =>
        a.id === app.id ? { ...a, _syncing: false, _sync_error: true } : a
      ));
    }
  }, []);

  const handleChangeEstadoAplicacion = useCallback((app, nuevoEstado, lotes, onAuditLogged, onLoteObsUpdated) => {
    const estadoActual = normalizarEstado(app.estado_programacion);
    const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
    if (!permitidos.includes(nuevoEstado)) return;

    if (nuevoEstado === ESTADOS_APLICACION.EJECUTADA) {
      setConfirmEjecutadaModal({ open: true, app });
      return;
    }

    aplicarCambioEstado(app, nuevoEstado, lotes, onAuditLogged, onLoteObsUpdated);
  }, [aplicarCambioEstado]);

  const handleReintentarSync = useCallback(async (app, lotes, onCostCreated, onLoteObsUpdated, onAuditLogged) => {
    const esIdLocal = app.id && app.id.startsWith('app-');

    if (esIdLocal) {
      // Retry INSERT
      const dbPayload = {
        lote_id: app.lote_id,
        tipo_aplicacion: app.tipo_aplicacion,
        tipo_producto: app.tipo_producto,
        producto_comercial: app.producto_comercial,
        ingrediente_activo: app.ingrediente_activo,
        dosis: app.dosis,
        volumen_aplicado: app.volumen_aplicado ?? null,
        metodo_aplicacion: app.metodo_aplicacion,
        operario_responsable: app.operario_responsable,
        maquinaria_utilizada: app.maquinaria_utilizada ?? null,
        fecha_aplicacion: app.fecha_aplicacion,
        costo_aplicacion: app.costo_aplicacion ?? 0,
        periodo_carencia_dias: app.periodo_carencia_dias ?? null,
        estado_programacion: normalizarEstado(app.estado_programacion),
        updated_by: 'Andrés Castro'
      };

      setAplicaciones(prev => prev.map(a => a.id === app.id ? { ...a, _syncing: true, _sync_error: false } : a));

      try {
        const savedApp = await applicationRepository.insert(dbPayload);
        if (!savedApp) throw new Error('No data received from DB insert retry');

        const finalApp = createApplication({
          ...savedApp,
          _syncing: false,
          _sync_error: false
        });

        setAplicaciones(prev => prev.map(a => a.id === app.id ? finalApp : a));

        if (finalApp.costo_aplicacion > 0 && onCostCreated) {
          onCostCreated({
            id: `cos-plan-${finalApp.id}`,
            lote_id: finalApp.lote_id,
            categoria: 'Aplicaciones',
            fecha: finalApp.fecha_aplicacion?.split('T')[0] || new Date().toISOString().split('T')[0],
            descripcion: `Aplicación planificada: ${finalApp.producto_comercial}`,
            costo: finalApp.costo_aplicacion,
            responsable: finalApp.operario_responsable
          });
        }

        if (onLoteObsUpdated) {
          onLoteObsUpdated(finalApp.lote_id, `Aplicación programada: ${finalApp.producto_comercial}.`);
        }

        const targetL = lotes.find(l => l.id === finalApp.lote_id);
        if (onAuditLogged) {
          onAuditLogged(targetL?.codigo_interno || 'N/A', `Aplicación planificada: ${finalApp.producto_comercial} [${finalApp.codigo_apl || '...'}]`);
        }
      } catch (err) {
        console.error('[RETRY INSERT] failed:', err.message);
        setAplicaciones(prev => prev.map(a => a.id === app.id ? { ...a, _syncing: false, _sync_error: true } : a));
      }
    } else {
      // Retry UPDATE
      setAplicaciones(prev => prev.map(a => a.id === app.id ? { ...a, _syncing: true, _sync_error: false } : a));

      try {
        const payload = {
          estado_programacion: normalizarEstado(app.estado_programacion),
          updated_by: 'Andrés Castro'
        };
        if (app.fecha_ejecucion) payload.fecha_ejecucion = app.fecha_ejecucion;

        const updatedApp = await applicationRepository.update(app.id, payload);
        if (!updatedApp) throw new Error('No data received from DB update retry');

        const finalApp = createApplication({
          ...updatedApp,
          _syncing: false,
          _sync_error: false
        });

        setAplicaciones(prev => prev.map(a => a.id === app.id ? finalApp : a));

        if (onLoteObsUpdated && finalApp.estado_programacion === ESTADOS_APLICACION.EJECUTADA) {
          onLoteObsUpdated(finalApp.lote_id, `Aplicación ejecutada: ${finalApp.producto_comercial} (Carencia: ${finalApp.periodo_carencia_dias}d).`);
        }
      } catch (err) {
        console.error('[RETRY UPDATE] failed:', err.message);
        setAplicaciones(prev => prev.map(a => a.id === app.id ? { ...a, _syncing: false, _sync_error: true } : a));
      }
    }
  }, []);

  return {
    aplicaciones,
    aplicacionesLoading,
    isAppDrawerOpen,
    aplicacionesMode,
    activeAplicacionesTab,
    confirmEjecutadaModal,
    newAplicacion,
    setAplicaciones,
    setIsAppDrawerOpen,
    setAplicacionesMode,
    setActiveAplicacionesTab,
    setConfirmEjecutadaModal,
    setNewAplicacion,
    loadApplications,
    handleAddAplicacion,
    handleSavePlanificador,
    handleChangeEstadoAplicacion,
    aplicarCambioEstado,
    handleReintentarSync
  };
};
