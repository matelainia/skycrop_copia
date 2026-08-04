/**
 * EmptyPlansState.jsx  ·  components/plans/
 * Estado vacío elegante para cuando no existen planes de fertilización.
 *
 * @param {function} [onCreatePlan] - Callback para el botón CTA
 */
import React from 'react';
import { Leaf, Plus } from 'lucide-react';

const EmptyPlansState = React.memo(function EmptyPlansState({ onCreatePlan }) {
  return (
    <div className="plans-empty" role="status" aria-label="Sin planes de fertilización">
      <div className="plans-empty__icon-tile" aria-hidden="true">
        <Leaf size={28} />
      </div>
      <div className="plans-empty__title">No existen planes de fertilización</div>
      <p className="plans-empty__subtitle">
        Crea el primer plan para comenzar a gestionar la nutrición de tus cultivos.
      </p>
      {onCreatePlan && (
        <button
          className="fert-btn fert-btn--primary"
          onClick={onCreatePlan}
          id="empty-plans-create-btn"
        >
          <Plus size={16} aria-hidden="true" />
          Crear primer plan
        </button>
      )}
    </div>
  );
});

export default EmptyPlansState;
