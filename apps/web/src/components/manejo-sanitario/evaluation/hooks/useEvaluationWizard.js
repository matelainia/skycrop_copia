import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../services/supabase.service';
import { useCompanyContext } from '../../../../context/CompanyContext';
import { EvaluationService } from '../services/EvaluationService';
import { Evaluation } from '../domain/entities/Evaluation';
import { EvaluationDraft } from '../domain/entities/EvaluationDraft';
import { EvaluationProtocol } from '../domain/entities/EvaluationProtocol';
import { EvaluationStateMachine, EVALUATION_STATES } from '../domain/services/EvaluationStateMachine';
import { ProtocolCalculationEngine } from '../../domain/services/ProtocolCalculationEngine';
import { ProtocolRuleEngine } from '../../domain/services/ProtocolRuleEngine';
import { EvaluationValidator } from '../domain/services/EvaluationValidator';
import { agronomyRepository } from '../../repositories/agronomyRepository';

// ─── Formulario por defecto ────────────────────────────────────────────────
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

// ─── Hook principal ────────────────────────────────────────────────────────
export function useEvaluationWizard(
  userId,
  currentCompanyName,
  logAudit,
  onBackToList,
  mode = 'create',
  initialMonitoreo = null
) {
  const { companyId } = useCompanyContext();

  // ── Paso del wizard (1–4) y máquina de estados
  const [step, setStep] = useState(mode === 'view' ? 4 : 1);
  const stateMachineRef = useRef(
    new EvaluationStateMachine(
      mode === 'view'
        ? (initialMonitoreo?.evaluation_status || EVALUATION_STATES.CONSOLIDADA)
        : EVALUATION_STATES.BORRADOR
    )
  );
  const [currentState, setCurrentState] = useState(stateMachineRef.current.state);

  // ── Datos del formulario
  const [formData, setFormData] = useState(() => {
    if (mode === 'view' && initialMonitoreo) {
      return {
        companyId:          initialMonitoreo.company_id || '',
        predioId:           initialMonitoreo.predio_id || '',
        loteId:             initialMonitoreo.lote_id || '',
        tipoMonitoreo:      initialMonitoreo.tipo_monitoreo || 'Sanitario',
        objetoEvaluacionId: initialMonitoreo.objeto_evaluacion?.id || initialMonitoreo.objeto_evaluacion_id || '',
        valoresEvaluacion:  initialMonitoreo.valores_evaluacion || {},
        puntosEvaluados:    initialMonitoreo.valores_evaluacion?.puntos_evaluados || 100,
        observaciones:      initialMonitoreo.observaciones || '',
        photos:             [],
        responsable:        initialMonitoreo.responsable || '',
        fecha:              initialMonitoreo.fecha_monitoreo
                              ? new Date(initialMonitoreo.fecha_monitoreo).toISOString().split('T')[0]
                              : new Date().toISOString().split('T')[0],
        estadoSanitario:    initialMonitoreo.estado_sanitario || 'excelente'
      };
    }
    return { ...DEFAULT_FORM_STATE, companyId: companyId || '', responsable: currentCompanyName || '' };
  });

  // ── Datos maestros
  const [companies, setCompanies]   = useState([]);
  const [predios,   setPredios]     = useState([]);
  const [lotes,     setLotes]       = useState([]);

  // ── Estado de UI
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [geoInfo,    setGeoInfo]    = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // ── Datos agronómicos (formulario de monitoreo)
  const [agronomyForm, setAgronomyForm] = useState(null);

  // ── Protocolo completo cargado vía RPC get_protocolo_completo
  const [fullProtocol, setFullProtocol] = useState(null);
  const [protocolLoading, setProtocolLoading] = useState(false);

  // ── Resultados en tiempo real de los motores
  const [liveCalcResult,  setLiveCalcResult]  = useState(null);
  const [liveRuleResult,  setLiveRuleResult]  = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // UTILIDAD: transicionar estado de la máquina
  // ─────────────────────────────────────────────────────────────────────────
  const transitionState = useCallback((targetState) => {
    try {
      if (stateMachineRef.current.canTransitionTo(targetState)) {
        stateMachineRef.current.transitionTo(targetState);
        setCurrentState(stateMachineRef.current.state);
      }
    } catch (e) {
      console.warn('[useEvaluationWizard] Transición de estado inválida:', e.message);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CARGA DE DATOS MAESTROS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'view') return;
    supabase.from('companies').select('id, nombre').then(({ data }) => {
      if (data && data.length > 0) {
        setCompanies(data);
        setFormData(prev => ({ ...prev, companyId: prev.companyId || data[0].id }));
      } else {
        const fallback = { id: companyId || 'default-company', nombre: currentCompanyName || 'Empresa Principal' };
        setCompanies([fallback]);
        setFormData(prev => ({ ...prev, companyId: fallback.id }));
      }
    }).catch(() => {
      const fallback = { id: companyId || 'default-company', nombre: currentCompanyName || 'Empresa Principal' };
      setCompanies([fallback]);
      setFormData(prev => ({ ...prev, companyId: fallback.id }));
    });
  }, [mode]);

  useEffect(() => {
    if (mode === 'view' || !formData.companyId) { setPredios([]); return; }
    supabase.from('predios').select('id, nombre, ubicacion')
      .eq('company_id', formData.companyId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPredios(data);
          setFormData(prev => ({ ...prev, predioId: prev.predioId || data[0].id }));
        } else {
          const fallback = { id: 'default-predio', nombre: 'Predio Principal' };
          setPredios([fallback]);
          setFormData(prev => ({ ...prev, predioId: fallback.id }));
        }
      }).catch(() => {
        const fallback = { id: 'default-predio', nombre: 'Predio Principal' };
        setPredios([fallback]);
        setFormData(prev => ({ ...prev, predioId: fallback.id }));
      });
  }, [formData.companyId, mode]);

  useEffect(() => {
    if (mode === 'view' || !formData.predioId) { setLotes([]); return; }
    supabase.from('lotes')
      .select('*, cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)')
      .eq('predio_id', formData.predioId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLotes(data);
          setFormData(prev => ({ ...prev, loteId: prev.loteId || data[0].id }));
        } else {
          // Fallback a lotes generales si la consulta por predio no trae filas
          supabase.from('lotes')
            .select('*, cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)')
            .limit(20)
            .then(({ data: allLotes }) => {
              if (allLotes && allLotes.length > 0) {
                setLotes(allLotes);
                setFormData(prev => ({ ...prev, loteId: prev.loteId || allLotes[0].id }));
              }
            });
        }
      }).catch(() => {
        supabase.from('lotes')
          .select('*, cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)')
          .limit(20)
          .then(({ data: allLotes }) => {
            if (allLotes && allLotes.length > 0) {
              setLotes(allLotes);
              setFormData(prev => ({ ...prev, loteId: prev.loteId || allLotes[0].id }));
            }
          });
      });
  }, [formData.predioId, mode]);

  // ─────────────────────────────────────────────────────────────────────────
  // DATOS DERIVADOS: lote y objeto seleccionados
  // ─────────────────────────────────────────────────────────────────────────
  const selectedLoteData = useMemo(
    () => lotes.find(l => l.id === formData.loteId) || null,
    [lotes, formData.loteId]
  );

  const selectedObjetoData = useMemo(() => {
    if (!agronomyForm || !formData.objetoEvaluacionId) return null;
    return agronomyForm.objetos?.find(o => o.id === formData.objetoEvaluacionId) || null;
  }, [agronomyForm, formData.objetoEvaluacionId]);

  // ─────────────────────────────────────────────────────────────────────────
  // CARGA DEL PROTOCOLO COMPLETO VÍA RPC (1 SOLA CONSULTA)
  // ─────────────────────────────────────────────────────────────────────────
  const loadFullProtocol = useCallback(async (protocolId, objetoData) => {
    if (!protocolId) {
      setFullProtocol(null);
      return;
    }
    setProtocolLoading(true);
    try {
      // get_protocolo_completo retorna { protocolo, variables, umbrales, reglas }
      const { data, error: rpcErr } = await supabase
        .rpc('get_protocolo_completo', { p_id: protocolId });

      if (rpcErr) throw rpcErr;
      if (!data) { setFullProtocol(null); return; }

      const protocol = EvaluationProtocol.fromAPIResponse(data, objetoData || {});
      setFullProtocol(protocol);
    } catch (err) {
      console.warn('[useEvaluationWizard] Error cargando protocolo completo:', err.message);
      setFullProtocol(null);
    } finally {
      setProtocolLoading(false);
    }
  }, []);

  // Cargar protocolo cuando cambia el objeto de evaluación
  useEffect(() => {
    if (!selectedObjetoData?.protocolo?.id) {
      setFullProtocol(null);
      return;
    }
    loadFullProtocol(selectedObjetoData.protocolo.id, selectedObjetoData);
  }, [selectedObjetoData?.protocolo?.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // EVALUACIÓN EN TIEMPO REAL (< 100ms por ejecución, en memoria)
  // Se dispara con cada cambio en los valores del formulario.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fullProtocol || stateMachineRef.current.isLocked()) {
      return;
    }

    const loteMetadata = {
      area_ha:        selectedLoteData?.area_ha,
      cultivo:        selectedLoteData?.cultivo_ref?.nombre_comun || selectedLoteData?.cultivo,
      codigo_interno: selectedLoteData?.codigo_interno
    };

    // ── Motor de Cálculo
    const calcResult = ProtocolCalculationEngine.compute(
      {
        variables:       fullProtocol.variables,
        indicadores:     fullProtocol.indicadores,
        umbrales:        fullProtocol.umbrales,
        reglas:          fullProtocol.reglas,
        tamanio_muestra: fullProtocol.tamanioMuestra,
        metodo_seleccion: fullProtocol.metodoSeleccion
      },
      {
        ...formData.valoresEvaluacion,
        puntos_evaluados: formData.puntosEvaluados
      },
      loteMetadata
    );

    // ── Motor de Reglas (consume los cálculos)
    const ruleResult = ProtocolRuleEngine.evaluate(
      { umbrales: fullProtocol.umbrales, reglas: fullProtocol.reglas },
      calcResult,
      {
        ...formData.valoresEvaluacion,
        puntos_evaluados: formData.puntosEvaluados
      }
    );

    setLiveCalcResult(calcResult);
    setLiveRuleResult(ruleResult);

    // Actualizar estado sanitario derivado del nivel de riesgo
    const healthMap = {
      'Sin riesgo': 'excelente',
      'Bajo':       'bueno',
      'Medio':      'regular',
      'Alto':       'malo',
      'Crítico':    'bajo'
    };
    const derivedHealth = healthMap[ruleResult.globalRiskLevel] || 'excelente';
    if (derivedHealth !== formData.estadoSanitario) {
      setFormData(prev => ({ ...prev, estadoSanitario: derivedHealth }));
    }
  }, [
    formData.valoresEvaluacion,
    formData.puntosEvaluados,
    fullProtocol,
    selectedLoteData
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTRICAS DERIVADAS (para compatibilidad con componentes existentes)
  // ─────────────────────────────────────────────────────────────────────────
  const derivedMetrics = useMemo(() => {
    if (liveCalcResult && liveRuleResult) {
      return {
        areaEvaluada:   liveCalcResult.evaluatedArea,
        coberturaPct:   liveCalcResult.coveragePct,
        incidenciaPct:  liveCalcResult.incidencePct,
        severidadPct:   liveCalcResult.severityPct,
        health:         formData.estadoSanitario,
        riskLevel:      liveRuleResult.globalRiskLevel,
        alerts:         liveRuleResult.alerts,
        alertCount:     liveRuleResult.alertCount,
        completedVars:  liveCalcResult.completedVariables,
        pendingVars:    liveCalcResult.pendingVariables,
        scaleInterpretations: liveCalcResult.scaleInterpretations,
        // Compatibilidad con componentes legacy
        recs: {
          cobertura: {
            status: liveCalcResult.coveragePct >= 80 ? 'success' : 'warning',
            msg: liveCalcResult.coveragePct >= 80
              ? '✅ Cobertura óptima alcanzada para el tamaño de la muestra.'
              : `⚠ Cobertura insuficiente (${liveCalcResult.coveragePct}%).`
          },
          hallazgos: {
            status: liveRuleResult.globalRiskLevel === 'Crítico' || liveRuleResult.globalRiskLevel === 'Alto' ? 'danger'
                  : liveRuleResult.globalRiskLevel === 'Medio' ? 'warning'
                  : 'success',
            msg: liveRuleResult.recommendations?.[0]?.mensaje || 'Sin hallazgos significativos.'
          }
        }
      };
    }

    // Fallback para modo vista sin motores
    if (mode === 'view' && initialMonitoreo) {
      const inc = initialMonitoreo.incidencia_pct || 0;
      return {
        areaEvaluada:  0,
        coberturaPct:  100,
        incidenciaPct: inc,
        severidadPct:  initialMonitoreo.severidad_pct || 0,
        health:        initialMonitoreo.estado_sanitario || 'excelente',
        riskLevel:     inc > 15 ? 'Alto' : inc > 5 ? 'Medio' : 'Bajo',
        alerts:        [],
        alertCount:    0,
        completedVars: 0,
        pendingVars:   [],
        scaleInterpretations: {},
        recs: { cobertura: { status: 'success', msg: '' }, hallazgos: { status: 'success', msg: '' } }
      };
    }

    return {
      areaEvaluada: 0, coberturaPct: 0, incidenciaPct: 0, severidadPct: 0,
      health: 'excelente', riskLevel: 'Sin riesgo', alerts: [], alertCount: 0,
      completedVars: 0, pendingVars: [],
      scaleInterpretations: {},
      recs: {
        cobertura: { status: 'warning', msg: 'Defina los puntos evaluados para ver la cobertura.' },
        hallazgos: { status: 'success', msg: '' }
      }
    };
  }, [liveCalcResult, liveRuleResult, formData.estadoSanitario, mode, initialMonitoreo]);

  // ─────────────────────────────────────────────────────────────────────────
  // CARGA DEL LOTE: geocodificación + formulario de monitoreo + borrador
  // ─────────────────────────────────────────────────────────────────────────
  const loadLoteDetails = useCallback(async (loteId) => {
    if (!loteId) return;
    setGeoLoading(true);
    setError(null);
    try {
      if (mode === 'view') {
        const { data: loteRecord } = await supabase
          .from('lotes')
          .select('*, cultivo_ref:cultivo_id (id, nombre_comun, nombre_cientifico)')
          .eq('id', loteId).single();
        if (loteRecord) setLotes([loteRecord]);
      }

      const [geo, form] = await Promise.all([
        EvaluationService.geocodeLote(loteId),
        agronomyRepository.getFormularioMonitoreo(loteId)
      ]);
      setGeoInfo(geo);
      setAgronomyForm(form);

      // Recuperar borrador existente
      if (mode !== 'view') {
        const activeDraft = await EvaluationService.getDraft(loteId, userId, formData.companyId);
        if (activeDraft) {
          const acceptDraft = window.confirm(
            `Borrador guardado el ${new Date(activeDraft.updatedAt).toLocaleString()}.\n¿Deseas recuperar tu progreso?`
          );
          if (acceptDraft) {
            const s = activeDraft.stateData;
            setFormData(prev => ({ ...prev, ...s }));
            const recoveredStep = s.currentStep || 1;
            setStep(recoveredStep);
            const mappedState = EvaluationStateMachine.fromWizardStep(recoveredStep);
            try { stateMachineRef.current.transitionTo(mappedState); } catch (_) {}
            setCurrentState(stateMachineRef.current.state);
          }
        }
      }
    } catch (err) {
      console.error('[useEvaluationWizard] Error cargando lote:', err);
      setError('Error al obtener la información agronómica del lote.');
    } finally {
      setGeoLoading(false);
    }
  }, [userId, formData.companyId, mode]);

  useEffect(() => {
    if (formData.loteId) {
      loadLoteDetails(formData.loteId);
      transitionState(EVALUATION_STATES.CAPTURANDO);
    } else {
      setGeoInfo(null);
      setAgronomyForm(null);
      setFullProtocol(null);
    }
  }, [formData.loteId]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE DE BORRADOR
  // ─────────────────────────────────────────────────────────────────────────
  const autoSaveDraft = useCallback(async (currentStepNum) => {
    if (!formData.loteId || !userId) return;
    setSaveStatus('saving');
    try {
      await EvaluationService.saveDraft(new EvaluationDraft({
        companyId: formData.companyId,
        userId,
        loteId:    formData.loteId,
        stepName:  currentState,
        stateData: { ...formData, currentStep: currentStepNum }
      }));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [formData, userId, currentState]);

  // ─────────────────────────────────────────────────────────────────────────
  // NAVEGACIÓN ENTRE PASOS
  // ─────────────────────────────────────────────────────────────────────────
  const nextStep = async () => {
    // Verificar bloqueo de estado
    if (stateMachineRef.current.isLocked()) {
      console.warn('[useEvaluationWizard] La evaluación está bloqueada en estado:', currentState);
      return;
    }

    let validation;
    if (step === 1) {
      validation = EvaluationValidator.validateStep1(formData);
    } else if (step === 2) {
      validation = EvaluationValidator.validateStep2(formData);
      if (fullProtocol) {
        const nextValores = { ...formData.valoresEvaluacion };
        fullProtocol.variables.forEach(v => {
          if (nextValores[v.clave] === undefined) {
            nextValores[v.clave] = v.tipo === 'Booleano' ? false : '';
          }
        });
        setFormData(prev => ({ ...prev, valoresEvaluacion: nextValores }));
      }
    } else if (step === 3) {
      validation = EvaluationValidator.validateStep3(
        formData.valoresEvaluacion,
        // Compatibilidad con la entidad legacy (protocolInstance)
        fullProtocol ? { variables: fullProtocol.variables, tamanioMuestra: fullProtocol.tamanioMuestra } : null,
        parseFloat(formData.puntosEvaluados)
      );
      if (validation?.isValid) {
        transitionState(EVALUATION_STATES.VALIDADA);
      }
    } else if (step === 4) {
      validation = EvaluationValidator.validateStep4(formData);
    }

    if (validation && !validation.isValid) {
      alert(`Validación fallida:\n${Object.values(validation.errors).join('\n')}`);
      return;
    }

    const nextS = step + 1;
    if (nextS <= 4) {
      setStep(nextS);
      await autoSaveDraft(nextS);
      if (logAudit) {
        logAudit(selectedLoteData?.codigo_interno || 'N/A', `Paso ${step} completado. Avanzando al paso ${nextS}.`);
      }
    } else {
      await saveEvaluation();
    }
  };

  const prevStep = () => {
    const prevS = step - 1;
    if (prevS >= 1) {
      setStep(prevS);
      if (prevS <= 2 && currentState !== EVALUATION_STATES.BORRADOR) {
        try {
          if (stateMachineRef.current.canTransitionTo(EVALUATION_STATES.CAPTURANDO)) {
            stateMachineRef.current.transitionTo(EVALUATION_STATES.CAPTURANDO);
            setCurrentState(EVALUATION_STATES.CAPTURANDO);
          }
        } catch (_) {}
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GUARDADO FINAL — PERSISTENCIA ATÓMICA V2
  // ─────────────────────────────────────────────────────────────────────────
  const saveEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const calcResult = liveCalcResult || ProtocolCalculationEngine.compute(
        fullProtocol
          ? { variables: fullProtocol.variables, umbrales: fullProtocol.umbrales, reglas: fullProtocol.reglas, tamanio_muestra: fullProtocol.tamanioMuestra }
          : {},
        { ...formData.valoresEvaluacion, puntos_evaluados: formData.puntosEvaluados },
        { area_ha: selectedLoteData?.area_ha }
      );

      const ruleResult = liveRuleResult || ProtocolRuleEngine.evaluate(
        fullProtocol ? { umbrales: fullProtocol.umbrales, reglas: fullProtocol.reglas } : {},
        calcResult,
        { ...formData.valoresEvaluacion, puntos_evaluados: formData.puntosEvaluados }
      );

      // Construir variables del snapshot con interpretación de escalas
      const snapshotVariables = (fullProtocol?.variables || []).map((v, idx) => ({
        variable_clave:   v.clave,
        etiqueta:         v.etiqueta,
        tipo:             v.tipo,
        unidad:           v.unidad || null,
        obligatorio:      v.obligatorio !== false,
        orden:            v.orden ?? idx,
        valor_capturado:  String(formData.valoresEvaluacion[v.clave] ?? ''),
        interpretacion:   calcResult.scaleInterpretations?.[v.clave]?.nivel || null,
        escala_nivel:     calcResult.scaleInterpretations?.[v.clave]?.nivel || null,
        escala_color:     calcResult.scaleInterpretations?.[v.clave]?.color || null
      }));

      const evalInstance = new Evaluation({
        companyId:              formData.companyId,
        loteId:                 formData.loteId,
        objetoEvaluacionId:     formData.objetoEvaluacionId,
        protocoloVersionId:     fullProtocol?.id || null,
        tipoMonitoreo:          formData.tipoMonitoreo,
        responsable:            formData.responsable,
        valoresEvaluacion:      formData.valoresEvaluacion,
        incidenciaPct:          calcResult.incidencePct,
        severidadPct:           calcResult.severityPct,
        observaciones:          formData.observaciones,
        estadoSanitario:        formData.estadoSanitario,
        // Campos del protocolo snapshot
        protocolSnapshot:       fullProtocol?.toSnapshot() || null,
        calculationResult:      calcResult,
        ruleResult,
        snapshotVariables,
        snapshotRules:          (fullProtocol?.reglas || []).map(r => ({
          ...r,
          fue_disparada: ruleResult.firedRules?.find(fr => fr.variable_clave === r.variable_clave)?.fue_disparada || false
        })),
        snapshotThresholds:     ruleResult.enrichedThresholds || [],
        snapshotAlerts:         ruleResult.alerts || [],
        snapshotRecommendations: ruleResult.recommendations || []
      });

      const result = await EvaluationService.submitEvaluation(evalInstance, userId);

      // Transicionar a CONSOLIDADA
      try {
        stateMachineRef.current.transitionTo(EVALUATION_STATES.CONSOLIDADA);
        setCurrentState(EVALUATION_STATES.CONSOLIDADA);
      } catch (_) {}

      if (logAudit) {
        logAudit(selectedLoteData?.codigo_interno || 'N/A', `Evaluación consolidada. ID: ${result?.evaluation_id || result}`);
      }
      alert('Evaluación guardada y consolidada correctamente.');
      if (onBackToList) onBackToList();
    } catch (err) {
      console.error('[useEvaluationWizard] Error al guardar evaluación:', err);
      setError(err.message || 'Error guardando la evaluación. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CANCELAR WIZARD
  // ─────────────────────────────────────────────────────────────────────────
  const cancelWizard = () => {
    if (window.confirm('¿Estás seguro de que deseas cancelar? Se perderá el progreso sin guardar.')) {
      if (formData.loteId) {
        EvaluationService.saveDraft(new EvaluationDraft({
          companyId: formData.companyId,
          userId,
          loteId:    formData.loteId,
          stepName:  EVALUATION_STATES.BORRADOR,
          stateData: {}
        })).catch(() => {});
      }
      if (logAudit) logAudit(selectedLoteData?.codigo_interno || 'N/A', 'Evaluación cancelada por el usuario');
      if (onBackToList) onBackToList();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // API PÚBLICA DEL HOOK
  // ─────────────────────────────────────────────────────────────────────────
  return {
    step,
    // Estado de la máquina formal
    currentState,
    evaluationStatus: currentState,
    stateInfo: EvaluationStateMachine.getStateInfo(currentState),
    isLocked: stateMachineRef.current.isLocked(),
    // Datos del formulario
    formData,
    setFormData,
    // Datos maestros
    companies,
    predios,
    lotes,
    // Datos agronómicos
    agronomyForm,
    geoInfo,
    geoLoading,
    // Protocolo completo
    fullProtocol,
    protocolLoading,
    // Compatibilidad legacy con protocolInstance
    protocolInstance: fullProtocol,
    selectedObjetoData,
    selectedLoteData,
    // Resultados en vivo de los motores
    liveCalcResult,
    liveRuleResult,
    derivedMetrics,
    // Estado UI
    loading,
    error,
    saveStatus,
    // Acciones
    nextStep,
    prevStep,
    cancelWizard,
    loadLoteDetails
  };
}
