import React from 'react';
import { Leaf, Plus } from 'lucide-react';

/**
 * DashboardHeader
 * Top section of the Fertilización dashboard.
 *
 * Layout: [icon tile] [H1 + subtitle]   [CTA button]
 *
 * @param {string}   activeTab          - Currently active tab id
 * @param {function} onNewRecommendation - Callback for "Nueva Recomendación" CTA
 * @param {function} onNewPlan          - Callback for "+ Nuevo Plan de Fertilización" CTA
 */
const DashboardHeader = React.memo(function DashboardHeader({
  activeTab = 'resumen',
  onNewRecommendation,
  onNewPlan,
}) {
  // CTA dinámico según el tab activo
  const isPlanesTab = activeTab === 'planes';
  const ctaLabel    = isPlanesTab ? '+ Nuevo Plan de Fertilización' : 'Nueva Recomendación';
  const ctaHandler  = isPlanesTab ? onNewPlan : onNewRecommendation;
  const ctaAriaLabel = isPlanesTab
    ? 'Crear nuevo plan de fertilización'
    : 'Crear nueva recomendación de fertilización';

  return (
    <div className="fert-header">
      <div className="fert-header__left">
        <div className="fert-header__icon-tile" aria-hidden="true">
          <Leaf size={28} />
        </div>
        <div>
          <h1 className="fert-header__title">Fertilización</h1>
          <p className="fert-header__subtitle">
            Planificación, recomendaciones y seguimiento nutricional de cultivos
          </p>
        </div>
      </div>

      <button
        className="fert-btn fert-btn--primary"
        onClick={ctaHandler}
        aria-label={ctaAriaLabel}
        id="fert-header-cta-btn"
      >
        <Plus size={16} />
        {ctaLabel}
      </button>
    </div>
  );
});

export default DashboardHeader;
