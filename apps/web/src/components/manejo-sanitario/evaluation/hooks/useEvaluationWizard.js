import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase.service';
import { useAuthContext } from '../../../../context/AuthContext';
import { useCompanyContext } from '../../../../context/CompanyContext';
import { EvaluationService } from '../services/EvaluationService';
import { Evaluation } from '../domain/entities/Evaluation';
import { EvaluationDraft } from '../domain/entities/EvaluationDraft';
import { EvaluationProtocol } from '../domain/entities/EvaluationProtocol';
import { EvaluationCalculator } from '../domain/services/EvaluationCalculator';
import { EvaluationValidator } from '../domain/services/EvaluationValidator';
import { agronomyRepository } from '../../repositories/agronomyRepository';

const MACHINE_STATES = {
  INITIAL: 'INITIAL',
  LOT_SELECTED: 'LOT_SELECTED',
  PROTOCOL_LOADED: 'PROTOCOL_LOADED',
  VARIABLES_COMPLETED: 'VARIABLES_COMPLETED',
  READY_TO_SAVE: 'READY_TO_SAVE',
  SAVED: 'SAVED'
};

const DEFAULT_FORM_STATE = {
  companyId: '',
  predioId: '',
  loteId: '',
  tipoMonitoreo: 'Sanitario',
  objetoEvaluacionId: '',
  valoresEvaluacion: {},
  puntosEvaluados: '',
  observaciones: '',
  photos: [],
  responsable: '',
  fecha: new Date().toISOString().split('T')[0],
  estadoSanitario: 'excelente'
};

export function useEvaluationWizard(userId, currentCompanyName, logAudit, onBackToList) {
  const { companyId } = useCompanyContext();
  
  // Estados de la UI y del Wizard
  const [machineState, setMachineState] = useState(MACHINE_STATES.INITIAL);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    ...DEFAULT_FORM_STATE,
    companyId: companyId || '',
    responsable: currentCompanyName || ''
  });

  // Datos maestros y cargando
  const [companies, setCompanies] = useState([]);
  const [predios, setPredios] = useState([]);
  const [lotes, setLotes] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  
  // Datos agronómicos cargados dinámicamente
  const [agronomyForm, setAgronomyForm] = useState(null);
  const [geoInfo, setGeoInfo] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Cargar Empresas
  useEffect(() => {
    async function loadCompanies() {
      try {
        const { data, error } = await supabase.from('companies').select('id, nombre');
        if (error) throw error;
        setCompanies(data || []);
        if (data && data.length > 0 && !formData.companyId) {
          setFormData(prev => ({ ...prev, companyId: data[0].id }));
        }
      } catch (err) {
        console.warn('Error loading companies:', err);
      }
    }
    loadCompanies();
  }, []);

  // Cargar Predios cuando cambia la empresa
  useEffect(() => {
    if (!formData.companyId) {
      setPredios([]);
      return;
    }
    async function loadPredios() {
      try {
        const { data, error } = await supabase
          .from('predios')
          .select('id, nombre, ubicacion')
          .eq('company_id', formData.companyId);
        if (error) throw error;
        setPredios(data || []);
      } catch (err) {
        console.warn('Error loading predios:', err);
      }
    }
    loadPredios();
  }, [formData.companyId]);

  // Cargar Lotes cuando cambia el predio
  useEffect(() => {
    if (!formData.predioId) {
      setLotes([]);
      return;
    }
    async function loadLotes() {
      try {
        const { data, error } = await supabase
          .from('lotes')
          .select('*, cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)')
          .eq('predio_id', formData.predioId);
        if (error) throw error;
        setLotes(data || []);
      } catch (err) {
        console.warn('Error loading lotes:', err);
      }
    }
    loadLotes();
  }, [formData.predioId]);

  // Lote seleccionado completo
  const selectedLoteData = useMemo(() => {
    return lotes.find(l => l.id === formData.loteId) || null;
  }, [lotes, formData.loteId]);

  // Objeto de evaluación seleccionado completo
  const selectedObjetoData = useMemo(() => {
    if (!agronomyForm || !formData.objetoEvaluacionId) return null;
    return agronomyForm.objetos.find(o => o.id === formData.objetoEvaluacionId) || null;
  }, [agronomyForm, formData.objetoEvaluacionId]);

  // Protocolo e Instancia del Protocolo de dominio
  const protocolInstance = useMemo(() => {
    if (!selectedObjetoData?.protocolo) return null;
    const proto = selectedObjetoData.protocolo;
    return new EvaluationProtocol({
      id: proto.id,
      version: proto.version,
      variables: proto.variables || [],
      frecuencia_dias: proto.frecuencia_dias,
      tamanio_muestra: proto.tamanio_muestra,
      metodologia: proto.metodologia
    });
  }, [selectedObjetoData]);

  // ── Cargar Datos Fitosanitarios y Geocodificación del Lote
  const loadLoteDetails = useCallback(async (loteId) => {
    if (!loteId) return;
    setGeoLoading(true);
    setError(null);
    try {
      // 1. Geocodificación inversa vía PostGIS / Nominatim
      const geo = await EvaluationService.geocodeLote(loteId);
      setGeoInfo(geo);

      // 2. Formulario de monitoreo (objetos, protocolos, reglas)
      const form = await agronomyRepository.getFormularioMonitoreo(loteId);
      setAgronomyForm(form);
      
      // Intentar recuperar borrador existente
      const activeDraft = await EvaluationService.getDraft(loteId, userId, formData.companyId);
      if (activeDraft) {
        const acceptDraft = window.confirm(
          `Hemos encontrado un borrador guardado el ${new Date(activeDraft.updatedAt).toLocaleString()}.\n¿Deseas recuperar tu progreso?`
        );
        if (acceptDraft) {
          const s = activeDraft.stateData;
          setFormData(prev => ({
            ...prev,
            ...s
          }));
          setStep(s.currentStep || 1);
          setMachineState(activeDraft.stepName || MACHINE_STATES.LOT_SELECTED);
          if (logAudit) {
            logAudit(selectedLoteData?.codigo_interno || 'N/A', 'Progreso de evaluación recuperado desde borrador');
          }
        } else {
          // Si lo rechaza, borramos el borrador
          await EvaluationService.saveDraft(new EvaluationDraft({
            companyId: formData.companyId,
            userId,
            loteId,
            stepName: MACHINE_STATES.INITIAL,
            stateData: {}
          }));
        }
      }
    } catch (err) {
      console.error('[useEvaluationWizard] Error cargando detalles del lote:', err);
      setError('Error al obtener la información agronómica del lote.');
    } finally {
      setGeoLoading(false);
    }
  }, [userId, formData.companyId, logAudit, selectedLoteData?.codigo_interno]);

  useEffect(() => {
    if (formData.loteId) {
      loadLoteDetails(formData.loteId);
    } else {
      setGeoInfo(null);
      setAgronomyForm(null);
    }
  }, [formData.loteId]);

  // ── Auto-Save de borrador al avanzar de paso
  const autoSaveDraft = useCallback(async (currentStep, nextStateName) => {
    if (!formData.loteId || !userId) return;
    setSaveStatus('saving');
    try {
      const draft = new EvaluationDraft({
        companyId: formData.companyId,
        userId,
        loteId: formData.loteId,
        stepName: nextStateName,
        stateData: {
          ...formData,
          currentStep
        }
      });
      await EvaluationService.saveDraft(draft);
      setSaveStatus('saved');
    } catch (err) {
      console.warn('[useEvaluationWizard] Autosave falló:', err);
      setSaveStatus('error');
    }
  }, [formData, userId]);

  // ── Cálculos derivados de dominio
  const derivedMetrics = useMemo(() => {
    const areaLote = selectedLoteData?.area_ha || 0;
    const puntosEvaluados = parseFloat(formData.puntosEvaluados) || 0;
    const puntosPlanificados = protocolInstance?.tamanioMuestra || 100;

    const areaEvaluada = EvaluationCalculator.calculateAreaEvaluada(areaLote, puntosEvaluados, puntosPlanificados);
    const coberturaPct = EvaluationCalculator.calculateCoberturaPct(puntosEvaluados, puntosPlanificados);
    const incidenciaPct = EvaluationCalculator.calculateIncidencia(formData.valoresEvaluacion);
    
    // Determinar color de severidad / salud
    let health = 'excelente';
    if (incidenciaPct > 15) health = 'bajo';
    else if (incidenciaPct > 5) health = 'regular';
    else if (incidenciaPct > 1) health = 'bueno';

    const recs = EvaluationCalculator.getSmartRecommendations(
      coberturaPct,
      puntosEvaluados,
      puntosPlanificados,
      incidenciaPct,
      selectedObjetoData?.nombre_comun || 'Plaga/Enfermedad'
    );

    return {
      areaEvaluada,
      coberturaPct,
      incidenciaPct,
      health,
      recs
    };
  }, [selectedLoteData, formData.puntosEvaluados, protocolInstance, formData.valoresEvaluacion, selectedObjetoData]);

  // ── Navegación entre pasos con Validaciones Zod/Reglas de Dominio
  const nextStep = async () => {
    let validation;
    let nextState;

    if (step === 1) {
      validation = EvaluationValidator.validateStep1(formData);
      nextState = MACHINE_STATES.LOT_SELECTED;
    } else if (step === 2) {
      validation = EvaluationValidator.validateStep2(formData);
      nextState = MACHINE_STATES.PROTOCOL_LOADED;
      
      // Al cambiar objeto, inicializar valores del protocolo si están vacíos
      if (protocolInstance) {
        const nextValores = { ...formData.valoresEvaluacion };
        protocolInstance.variables.forEach(v => {
          if (nextValores[v.clave] === undefined) {
            nextValores[v.clave] = v.tipo === 'boolean' ? false : '';
          }
        });
        setFormData(prev => ({ ...prev, valoresEvaluacion: nextValores }));
      }
    } else if (step === 3) {
      validation = EvaluationValidator.validateStep3(
        formData.valoresEvaluacion,
        protocolInstance,
        parseFloat(formData.puntosEvaluados)
      );
      nextState = MACHINE_STATES.VARIABLES_COMPLETED;
    } else if (step === 4) {
      validation = EvaluationValidator.validateStep4(formData);
      nextState = MACHINE_STATES.READY_TO_SAVE;
    }

    if (validation && !validation.isValid) {
      const msg = Object.values(validation.errors).join('\n');
      alert(`Validación fallida:\n${msg}`);
      return;
    }

    const nextS = step + 1;
    if (nextS <= 4) {
      setStep(nextS);
      setMachineState(nextState);
      await autoSaveDraft(nextS, nextState);
      if (logAudit) {
        logAudit(
          selectedLoteData?.codigo_interno || 'N/A',
          `Paso ${step} completado. Avanzando a: ${nextState}`
        );
      }
    } else {
      // Guardar final
      await saveEvaluation();
    }
  };

  const prevStep = () => {
    const prevS = step - 1;
    if (prevS >= 1) {
      setStep(prevS);
      // Ajustar estado de la máquina
      let prevState = MACHINE_STATES.INITIAL;
      if (prevS === 1) prevState = MACHINE_STATES.INITIAL;
      else if (prevS === 2) prevState = MACHINE_STATES.LOT_SELECTED;
      else if (prevS === 3) prevState = MACHINE_STATES.PROTOCOL_LOADED;
      
      setMachineState(prevState);
      if (logAudit) {
        logAudit(selectedLoteData?.codigo_interno || 'N/A', `Regresó al paso ${prevS}`);
      }
    }
  };

  // ── Guardado Final Transaccional
  const saveEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const evalInstance = new Evaluation({
        companyId:             formData.companyId,
        loteId:                formData.loteId,
        objetoEvaluacionId:   formData.objetoEvaluacionId,
        protocoloVersionId:   protocolInstance?.id || null,
        tipoMonitoreo:         formData.tipoMonitoreo,
        responsable:            formData.responsable,
        valoresEvaluacion:     formData.valoresEvaluacion,
        incidenciaPct:         derivedMetrics.incidenciaPct,
        severidadPct:          parseFloat(formData.valoresEvaluacion.severidad_visual ?? formData.valoresEvaluacion.nivel_dano ?? 0) || 0,
        humedadPct:            formData.valoresEvaluacion.humedad_pct ? parseFloat(formData.valoresEvaluacion.humedad_pct) : null,
        temperaturaC:          formData.valoresEvaluacion.temperatura_c ? parseFloat(formData.valoresEvaluacion.temperatura_c) : null,
        plagasDetectadas:      selectedObjetoData?.categoria.toLowerCase().includes('enfermedad') ? null : selectedObjetoData?.nombre_comun,
        enfermedadesDetectadas: selectedObjetoData?.categoria.toLowerCase().includes('enfermedad') ? selectedObjetoData?.nombre_comun : null,
        observaciones:          formData.observaciones,
        estadoSanitario:       derivedMetrics.health,
        fechaMonitoreo:        new Date(formData.fecha).toISOString()
      });

      const monId = await EvaluationService.submitEvaluation(evalInstance, userId);
      
      setMachineState(MACHINE_STATES.SAVED);
      if (logAudit) {
        logAudit(
          selectedLoteData?.codigo_interno || 'N/A',
          `Evaluación guardada exitosamente. ID: ${monId}`
        );
      }
      alert('Evaluación guardada de forma segura.');
      if (onBackToList) onBackToList();
    } catch (err) {
      console.error('[useEvaluationWizard] Error al guardar evaluación:', err);
      setError(err.message || 'Error guardando evaluación transaccional');
    } finally {
      setLoading(false);
    }
  };

  // ── Cancelar el Asistente
  const cancelWizard = () => {
    const confirmCancel = window.confirm(
      '¿Estás seguro de que deseas cancelar la evaluación? Se perderá el progreso sin guardar.'
    );
    if (confirmCancel) {
      // Eliminar borrador
      if (formData.loteId) {
        EvaluationService.saveDraft(new EvaluationDraft({
          companyId: formData.companyId,
          userId,
          loteId: formData.loteId,
          stepName: MACHINE_STATES.INITIAL,
          stateData: {}
        })).catch(() => {});
      }
      if (logAudit) {
        logAudit(selectedLoteData?.codigo_interno || 'N/A', 'Evaluación cancelada por el usuario');
      }
      if (onBackToList) onBackToList();
    }
  };

  return {
    step,
    machineState,
    formData,
    companies,
    predios,
    lotes,
    agronomyForm,
    geoInfo,
    geoLoading,
    loading,
    error,
    saveStatus,
    selectedLoteData,
    selectedObjetoData,
    protocolInstance,
    derivedMetrics,
    setFormData,
    nextStep,
    prevStep,
    cancelWizard,
    loadLoteDetails
  };
}
