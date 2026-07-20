import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

/**
 * ReviewButton
 * Tarjeta CTA verde premium para ir a la revisión final.
 *
 * @param {{ ready: boolean, onClick: () => void }} props
 */
const ReviewButton = ({ ready = false, onClick }) => {
  return (
    <div className="eval-review-card">
      <div className="eval-review-title">
        <ShieldCheck size={15} />
        {ready ? 'Lista para revisión' : 'Completar evaluación'}
      </div>

      <p className="eval-review-desc">
        {ready
          ? 'La evaluación está lista. Revisa los datos antes de guardar para garantizar trazabilidad.'
          : 'Completa las variables obligatorias para poder pasar a la revisión final.'
        }
      </p>

      <button
        type="button"
        className="eval-review-btn"
        onClick={onClick}
        disabled={!ready}
        style={{ opacity: ready ? 1 : 0.5, cursor: ready ? 'pointer' : 'not-allowed' }}
      >
        <span>Ir a revisión</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
};

export default ReviewButton;
