import { useState, useMemo, useCallback, useEffect } from 'react';
import { fertilizationPlansApi } from '../api/fertilization-plans.api.js';
import { fertilizationMasterDataApi } from '../api/fertilization-master-data.api.js';

const STEPS = [
  { id: 1, title: 'Información general', weight: 25 },
  { id: 2, title: 'Cultivo y suelo', weight: 20 },
  { id: 3, title: 'Plan de aplicaciones', weight: 40 },
  { id: 4, title: 'Confirmación', weight: 15 },
];

const INITIAL_EMPTY_DATA = {
  general: {
    name: '',
    responsibleId: '',
    responsibleName: '',
    lotId: '',
    lotName: '',
    sector: 'Sector Norte',
    area: 0,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  },
  crop: {
    cropId: '',
    cropName: 'Cacao',
    cropScientific: 'Theobroma cacao',
    stage: 'Llenado',
    density: 1100,
    soilType: 'Franco-arcilloso',
    targetPh: 6.4,
    lastAnalysisId: '',
  },
  applications: [],
  confirmation: {
    observations: '',
    attachments: [],
    notifyTeam: true,
  },
};

export function useFertilizationWizard(companyId = null) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState(INITIAL_EMPTY_DATA);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Master Data desde Supabase
  const [lotes, setLotes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [productos, setProductos] = useState([]);
  const [soilAnalyses, setSoilAnalyses] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  // Carga de datos reales de la empresa desde Supabase
  useEffect(() => {
    let isCancelled = false;
    async function loadMasterData() {
      setLoadingMasterData(true);
      try {
        const [lotesData, respData, prodData, soilData] = await Promise.all([
          fertilizationMasterDataApi.getLotes(companyId),
          fertilizationMasterDataApi.getResponsables(companyId),
          fertilizationMasterDataApi.getProductos(companyId),
          fertilizationMasterDataApi.getSoilAnalyses(companyId),
        ]);

        if (isCancelled) return;

        setLotes(lotesData);
        setResponsables(respData);
        setProductos(prodData);
        setSoilAnalyses(soilData);

        // Preselección por defecto si existen datos en Supabase
        if (lotesData.length > 0) {
          const firstLot = lotesData[0];
          setData(d => ({
            ...d,
            general: {
              ...d.general,
              lotId: firstLot.id,
              lotName: firstLot.nombre,
              area: firstLot.area_ha || 0,
              sector: firstLot.predios?.nombre || 'Sector General',
            },
            crop: {
              ...d.crop,
              soilType: firstLot.tipo_suelo || 'Franco-arcilloso',
              targetPh: firstLot.ph_base || 6.4,
            },
          }));
        }

        if (respData.length > 0) {
          const firstResp = respData[0];
          setData(d => ({
            ...d,
            general: {
              ...d.general,
              responsibleId: firstResp.id,
              responsibleName: firstResp.name,
            },
          }));
        }
      } catch (err) {
        console.warn('[Wizard] Error cargando datos de Supabase:', err);
      } finally {
        if (!isCancelled) setLoadingMasterData(false);
      }
    }

    loadMasterData();
    return () => {
      isCancelled = true;
    };
  }, [companyId]);

  // Selección dinámica de Lote
  const selectLote = useCallback((lotId) => {
    const selectedLot = lotes.find(l => String(l.id) === String(lotId));
    if (selectedLot) {
      setData(d => ({
        ...d,
        general: {
          ...d.general,
          lotId: selectedLot.id,
          lotName: selectedLot.nombre,
          area: selectedLot.area_ha || d.general.area,
          sector: selectedLot.predios?.nombre || d.general.sector,
        },
        crop: {
          ...d.crop,
          soilType: selectedLot.tipo_suelo || d.crop.soilType,
          targetPh: selectedLot.ph_base || d.crop.targetPh,
        },
      }));
    } else {
      setData(d => ({
        ...d,
        general: { ...d.general, lotId, lotName: lotId },
      }));
    }
  }, [lotes]);

  const completion = useMemo(() => {
    const checks = {
      1: !!(data.general.name && data.general.lotId && Number(data.general.area) > 0),
      2: !!(data.crop.cropName && data.crop.stage),
      3: data.applications.length > 0 && data.applications.every(a => a.productId && Number(a.dose) > 0),
      4: true,
    };
    return STEPS.reduce((acc, step) => acc + (checks[step.id] ? step.weight : 0), 0);
  }, [data]);

  const totalBudget = useMemo(() => {
    return data.applications.reduce((sum, a) => sum + (Number(a.cost) || 0), 0);
  }, [data.applications]);

  const validateStep = useCallback((step) => {
    const newErrors = {};
    if (step === 1) {
      if (!data.general.name) newErrors.name = 'El nombre del plan es requerido';
      if (!data.general.lotId) newErrors.lotId = 'Debes seleccionar un lote';
      if (!data.general.area || Number(data.general.area) <= 0) newErrors.area = 'Ingresa un área válida';
    }
    if (step === 2) {
      if (!data.crop.cropName) newErrors.cropName = 'Debes seleccionar un cultivo';
      if (!data.crop.stage) newErrors.stage = 'Selecciona la etapa fenológica';
    }
    if (step === 3) {
      if (data.applications.length === 0) {
        newErrors.applications = 'Agrega al menos una aplicación al plan';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data]);

  const goNext = () => {
    if (validateStep(currentStep) && currentStep < 4) {
      setCurrentStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const goToStep = (n) => {
    if (n < currentStep || validateStep(currentStep)) {
      setCurrentStep(n);
    }
  };

  const savePlan = async () => {
    setIsSubmitting(true);
    try {
      const createdPlan = await fertilizationPlansApi.createPlan({
        ...data,
        totalBudget,
      });
      setIsSubmitting(false);
      return createdPlan;
    } catch (err) {
      setIsSubmitting(false);
      throw err;
    }
  };

  return {
    currentStep,
    steps: STEPS,
    data,
    setData,
    errors,
    completion,
    totalBudget,
    isSubmitting,
    masterData: { lotes, responsables, productos, soilAnalyses, loading: loadingMasterData },
    selectLote,
    goNext,
    goBack,
    goToStep,
    validateStep,
    savePlan,
  };
}
