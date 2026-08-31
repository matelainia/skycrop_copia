import { memo } from 'react';
import { Leaf, BookOpen } from 'lucide-react';

const AplicacionesGuide = memo(function AplicacionesGuide({ onViewGuide }) {
  return (
    <div className="app-guide" role="region" aria-label="Información del módulo de aplicaciones">
      <div className="app-guide__icon" aria-hidden="true">
        <Leaf size={20} />
      </div>
      <div className="app-guide__content">
        <div className="app-guide__title">Seguimiento de Aplicaciones de Fertilizantes</div>
        <div className="app-guide__text">
          Registra y monitorea las aplicaciones de fertilizantes realizadas en tus cultivos. Mantén un control preciso de nutrientes aplicados, métodos y momentos para optimizar la nutrición de tus plantas.
        </div>
      </div>
      <button
        className="fert-btn fert-btn--outline app-guide__btn"
        onClick={onViewGuide}
        aria-label="Ver guía de uso de aplicaciones"
      >
        <BookOpen size={14} />
        Ver Guía de Uso
      </button>
    </div>
  );
});

export default AplicacionesGuide;
