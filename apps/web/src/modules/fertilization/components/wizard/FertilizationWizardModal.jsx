import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useFertilizationWizard } from '../../hooks/useFertilizationWizard.js';
import { CompletionRing } from '../../../../ui/CompletionRing.jsx';

import { PlanSummaryCard } from './PlanSummaryCard';
import Step1GeneralInfo from './Step1GeneralInfo';
import Step2CropSoil from './Step2CropSoil';
import Step3ApplicationsPlan from './Step3ApplicationsPlan';
import Step4Confirmation from './Step4Confirmation';
import '../../styles/wizard.css';

export function FertilizationWizardModal({ open, onClose, onCreated, companyId = null }) {
  const wizard = useFertilizationWizard(companyId);


  if (!open) return null;

  const handleCreatePlan = async () => {
    try {
      const plan = await wizard.savePlan();
      if (onCreated) onCreated(plan);
      onClose();
    } catch (err) {
      console.error('Error al guardar el plan:', err);
    }
  };

  const renderStep = () => {
    switch (wizard.currentStep) {
      case 1:
        return (
          <Step1GeneralInfo
            data={wizard.data}
            setData={wizard.setData}
            errors={wizard.errors}
            masterData={wizard.masterData}
            selectLote={wizard.selectLote}
          />
        );
      case 2:
        return (
          <Step2CropSoil
            data={wizard.data}
            setData={wizard.setData}
            errors={wizard.errors}
            masterData={wizard.masterData}
          />
        );
      case 3:
        return (
          <Step3ApplicationsPlan
            data={wizard.data}
            setData={wizard.setData}
            errors={wizard.errors}
            masterData={wizard.masterData}
          />
        );
      case 4:
        return (
          <Step4Confirmation
            data={wizard.data}
            setData={wizard.setData}
            totalBudget={wizard.totalBudget}
          />
        );
      default:
        return null;
    }
  };


  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <div className="wizard-container">
        {/* Header */}
        <div className="wizard-header">
          <div className="title-row">
            <span className="header-badge-icon">🌿</span>
            <div>
              <h2 id="wizard-title">Nuevo Plan de Fertilización</h2>
              <p className="subtitle">
                Planificación nutricional del cultivo: información general, aplicaciones y presupuesto
              </p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn close-btn" aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Steps Bar */}
        <div className="wizard-steps-bar">
          {wizard.steps.map((step, i) => {
            const isCurrent = wizard.currentStep === step.id;
            const isDone = wizard.currentStep > step.id;

            return (
              <div key={step.id} className="step-item">
                <button
                  type="button"
                  className={`step-dot ${isCurrent ? 'active' : ''} ${isDone ? 'done' : ''}`}
                  onClick={() => wizard.goToStep(step.id)}
                >
                  {isDone ? <Check size={14} /> : step.id}
                </button>
                <span className={`step-label ${isCurrent ? 'active-label' : ''}`}>{step.title}</span>
                {i < wizard.steps.length - 1 && (
                  <div className={`step-bar ${isDone ? 'done-bar' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Layout principal (Content + Sidebar) */}
        <div className="wizard-layout">
          <main className="wizard-content">{renderStep()}</main>

          <aside className="wizard-sidebar">
            <div className="completion-card">
              <CompletionRing percentage={wizard.completion} size={90} />
              <div className="completion-text">
                <span className="completion-title">Completitud</span>
                <span className="completion-sub">de la información del plan</span>
              </div>
            </div>

            <PlanSummaryCard data={wizard.data} totalBudget={wizard.totalBudget} />
          </aside>
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <button
            type="button"
            onClick={wizard.goBack}
            disabled={wizard.currentStep === 1}
            className="btn btn-ghost"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <div className="wizard-actions">
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                handleCreatePlan();
              }}
            >
              Guardar borrador
            </button>

            <button
              type="button"
              disabled={wizard.isSubmitting}
              onClick={wizard.currentStep === 4 ? handleCreatePlan : wizard.goNext}
              className="btn btn-primary"
            >
              {wizard.isSubmitting ? (
                'Guardando...'
              ) : wizard.currentStep === 4 ? (
                <>
                  <Check size={16} /> Crear plan
                </>
              ) : (
                <>
                  Siguiente <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
