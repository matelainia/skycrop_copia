import React from 'react';
import { Check } from 'lucide-react';

const WIZARD_STEPS = [
  { id: 1, label: 'Información del lote' },
  { id: 2, label: 'Tipo de evaluación' },
  { id: 3, label: 'Anotación de datos' },
  { id: 4, label: 'Revisión y guardar' }
];

export default function WizardStepper({ currentStep = 1 }) {
  return (
    <div className="eval-stepper">
      {WIZARD_STEPS.map((step, idx) => {
        const isDone   = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isPending = step.id > currentStep;

        return (
          <React.Fragment key={step.id}>
            {/* Paso */}
            <div className="eval-step">
              {/* Círculo */}
              <div className={`eval-step-circle ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                {isDone
                  ? <Check size={13} strokeWidth={3} />
                  : <span>{step.id}</span>
                }
              </div>

              {/* Etiqueta */}
              <div className="eval-step-label">
                <span className={`eval-step-title ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                  {step.label}
                </span>
                <span className="eval-step-subtitle">
                  {isDone ? 'Completado' : isActive ? 'Activo' : 'Pendiente'}
                </span>
              </div>
            </div>

            {/* Conector */}
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`eval-step-connector ${isDone ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
