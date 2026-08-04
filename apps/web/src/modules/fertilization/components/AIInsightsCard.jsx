import React from 'react';
import { BrainCircuit } from 'lucide-react';

/**
 * AIInsightsCard
 * Placeholder card for the future AI agronomic assistant.
 * Today shows "Próximamente" — when the AI service is ready,
 * replace this content with the actual insights component.
 *
 * The pulsing border animation is defined in fertilization.css (.fert-ai-card).
 */
const AIInsightsCard = React.memo(function AIInsightsCard() {
  return (
    <div
      className="fert-card fert-ai-card fert-card--static"
      role="region"
      aria-label="Asistente IA Agronómico — próximamente"
    >
      <div className="fert-ai-card__icon" aria-hidden="true">
        <BrainCircuit size={24} />
      </div>

      <div>
        <div className="fert-ai-card__title">Asistente IA Agronómico</div>
        <div className="fert-ai-card__subtitle">
          Análisis inteligente de fertilización para tus cultivos
        </div>
        <div className="fert-ai-card__badge">Próximamente</div>
      </div>
    </div>
  );
});

export default AIInsightsCard;
