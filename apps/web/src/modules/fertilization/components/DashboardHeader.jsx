import { memo } from 'react';
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
const DashboardHeader = memo(function DashboardHeader({
  activeTab = 'resumen',
  onNewRecommendation,
  onNewPlan,
  onNewAplicacion,
  onNewAnalisisSuelo,
}) {

  // CTA dinámico según el tab activo
  const isPlanesTab = activeTab === 'planes';
  const isAplicacionesTab = activeTab === 'aplicaciones';
  const isAnalisisTab = activeTab === 'analisis-suelos';
  let ctaLabel = 'Nueva Recomendación';
  let ctaHandler = onNewRecommendation;
  let ctaAriaLabel = 'Crear nueva recomendación de fertilización';
  if (isPlanesTab) {
    ctaLabel = '+ Nuevo Plan de Fertilización';
    ctaHandler = onNewPlan;
    ctaAriaLabel = 'Crear nuevo plan de fertilización';
  } else if (isAplicacionesTab) {
    ctaLabel = '+ Nueva Aplicación';
    ctaHandler = onNewAplicacion;
    ctaAriaLabel = 'Crear nueva aplicación de fertilización';
  } else if (isAnalisisTab) {
    ctaLabel = '+ Nuevo Análisis de Suelo';
    ctaHandler = onNewAnalisisSuelo;
    ctaAriaLabel = 'Crear nuevo análisis de suelo';
  }

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
