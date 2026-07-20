import React from 'react';
import { Check } from 'lucide-react';

/**
 * EvaluationStepper
 * Muestra el progreso del wizard de evaluación.
 *
 * @param {{ steps: Array<{id,label,sublabel,status:'done'|'active'|'pending'}>, currentStep: number }} props
 */
const EvaluationStepper = ({ steps = [], currentStep = 3 }) => {
  return (
    <div className="eval-stepper">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="eval-step">
            {/* Círculo de estado */}
            <div className={`eval-step-circle ${step.status}`}>
              {step.status === 'done'
                ? <Check size={13} strokeWidth={3} />
                : <span>{step.id}</span>
              }
            </div>

            {/* Etiquetas */}
            <div className="eval-step-label">
              <span className={`eval-step-title ${step.status}`}>
                {step.label}
              </span>
              <span className="eval-step-subtitle">{step.sublabel}</span>
            </div>
          </div>

          {/* Conector */}
          {idx < steps.length - 1 && (
            <div className={`eval-step-connector ${step.status === 'done' ? 'done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default EvaluationStepper;
