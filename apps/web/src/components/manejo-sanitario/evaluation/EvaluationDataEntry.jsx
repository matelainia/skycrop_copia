import React from 'react';
import { ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';
import './evaluation.css';

// Contexts
import { useAuthContext } from '../../../context/AuthContext';
import { useLotsContext } from '../context/LotsContext';

// Hook de la máquina de estados y dominio
import { useEvaluationWizard } from './hooks/useEvaluationWizard';

// Subcomponentes del Wizard
import WizardStepper from './components/WizardStepper';
import WizardSidebar from './components/WizardSidebar';
import Step1LotInfo from './components/Step1LotInfo';
import Step2EvaluationType from './components/Step2EvaluationType';
import Step3DataEntry from './components/Step3DataEntry';
import Step4Review from './components/Step4Review';

export default function EvaluationDataEntry({ onBack, onNext }) {
  const { user } = useAuthContext();
  const { logAudit } = useLotsContext();

  const userId = user?.id || 'user_clerk_test_a';
  const userName = user ? `${user.nombre} ${user.apellido}` : 'Sebastian Diaz';

  const wizard = useEvaluationWizard(userId, userName, logAudit, onBack);

  const {
    step,
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
    cancelWizard
  } = wizard;

  const getStepTitle = () => {
    switch (step) {
      case 1: return '1. Información del lote';
      case 2: return '2. Tipo de evaluación';
      case 3: return '3. Anotación de datos';
      case 4: return '4. Revisión y guardar';
      default: return 'Nueva Evaluación';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1: return 'Selecciona el lote o sector donde se realizará la evaluación.';
      case 2: return 'Determina el tipo de monitoreo de campo y el objeto de evaluación bajo protocolo.';
      case 3: return 'Digita las variables de campo y adjunta evidencia fotográfica.';
      case 4: return 'Verifica las alertas, cobertura y responsable técnico antes de consolidar el registro.';
      default: return '';
    }
  };

  const getNextButtonText = () => {
    if (step === 4) return 'Guardar evaluación';
    if (step === 1) return 'Siguiente: Tipo de evaluación';
    if (step === 2) return 'Siguiente: Anotación de datos';
    if (step === 3) return 'Siguiente: Revisión y guardar';
    return 'Siguiente';
  };

  const getCurrentStepName = () => {
    const names = ['Información del lote', 'Tipo de evaluación', 'Anotación de datos', 'Revisión y guardar'];
    return names[step - 1] || '';
  };

  return (
    <div className="eval-page-wrapper">

      {/* ── Cabecera de Página ── */}
      <div className="eval-page-header">
        {/* Título + breadcrumb (izquierda) */}
        <div className="eval-page-header-left">
          <h1 className="eval-page-title">Nueva Evaluación</h1>
          <nav className="eval-breadcrumb">
            <span className="eval-breadcrumb-link" onClick={cancelWizard}>
              Monitoreos y Evaluaciones
            </span>
            <ChevronRight size={12} className="eval-breadcrumb-sep" />
            <span className="eval-breadcrumb-link" onClick={cancelWizard}>
              Nueva Evaluación
            </span>
            <ChevronRight size={12} className="eval-breadcrumb-sep" />
            <span className="eval-breadcrumb-current">
              {getCurrentStepName()}
            </span>
          </nav>
        </div>

        {/* Acciones (derecha) */}
        <div className="eval-page-header-actions">
          {saveStatus === 'saving' && (
            <span className="eval-autosave-indicator">Autoguardando...</span>
          )}
          <button
            type="button"
            onClick={cancelWizard}
            className="eval-btn-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={loading || (step === 1 && !formData.loteId) || (step === 2 && !formData.objetoEvaluacionId)}
            className="eval-btn-primary-header"
          >
            {getNextButtonText()}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Stepper horizontal ── */}
      <WizardStepper currentStep={step} />

      {/* ── Cuerpo: dos columnas ── */}
      <div className="eval-layout">

        {/* Columna Izquierda: Formulario Principal */}
        <div className="eval-main-col eval-form-card">

          {error && (
            <div className="eval-error-banner">
              {error}
            </div>
          )}

          {/* Título del paso */}
          <div className="eval-step-header">
            <h2 className="eval-step-heading">{getStepTitle()}</h2>
            <p className="eval-step-desc">{getStepDescription()}</p>
          </div>

          {/* Contenido del paso */}
          {geoLoading && step === 1 ? (
            <div className="eval-loading-state">
              <div className="eval-spinner" />
              <span>Obteniendo ubicación y datos agronómicos del lote...</span>
            </div>
          ) : (
            <>
              {step === 1 && (
                <Step1LotInfo
                  formData={formData}
                  setFormData={setFormData}
                  companies={companies}
                  predios={predios}
                  lotes={lotes}
                  geoInfo={geoInfo}
                  geoLoading={geoLoading}
                  selectedLoteData={selectedLoteData}
                />
              )}
              {step === 2 && (
                <Step2EvaluationType
                  formData={formData}
                  setFormData={setFormData}
                  agronomyForm={agronomyForm}
                  selectedObjetoData={selectedObjetoData}
                />
              )}
              {step === 3 && (
                <Step3DataEntry
                  formData={formData}
                  setFormData={setFormData}
                  protocolInstance={protocolInstance}
                  derivedMetrics={derivedMetrics}
                />
              )}
              {step === 4 && (
                <Step4Review
                  formData={formData}
                  setFormData={setFormData}
                  selectedLoteData={selectedLoteData}
                  selectedObjetoData={selectedObjetoData}
                  derivedMetrics={derivedMetrics}
                  protocolInstance={protocolInstance}
                />
              )}
            </>
          )}

          {/* Footer de navegación */}
          <div className="eval-footer-actions">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1 || loading}
              className="eval-btn-back"
            >
              <ArrowLeft size={13} />
              Atrás
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={loading || (step === 1 && !formData.loteId) || (step === 2 && !formData.objetoEvaluacionId)}
              className="eval-btn-next"
            >
              {getNextButtonText()}
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Columna Derecha: Sidebar con 4 tarjetas */}
        <WizardSidebar
          selectedLote={selectedLoteData}
          selectedObjeto={selectedObjetoData}
          tipoMonitoreo={formData.tipoMonitoreo}
          fecha={formData.fecha}
          responsable={formData.responsable || userName}
          derivedMetrics={derivedMetrics}
          photos={formData.photos}
          step={step}
          onNextStep={nextStep}
        />
      </div>
    </div>
  );
}
