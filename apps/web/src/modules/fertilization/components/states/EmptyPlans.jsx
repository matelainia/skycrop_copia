import React from 'react';
import { Sprout, Plus } from 'lucide-react';

/**
 * EmptyPlans
 * Shown when the plans array is empty.
 * Includes a CTA to create the first plan.
 *
 * @param {function} onCreatePlan - optional callback for the CTA button
 */
export default function EmptyPlans({ onCreatePlan }) {
  return (
    <div className="fert-empty">
      <div className="fert-empty__icon">
        <Sprout size={24} />
      </div>
      <div className="fert-empty__title">No hay planes de fertilización</div>
      <div className="fert-empty__subtitle">
        Crea tu primer plan para comenzar a gestionar<br />la nutrición de tus cultivos.
      </div>
      {onCreatePlan && (
        <button
          className="fert-btn fert-btn--primary"
          onClick={onCreatePlan}
          aria-label="Crear primer plan de fertilización"
        >
          <Plus size={16} />
          Crear primer plan
        </button>
      )}
    </div>
  );
}
