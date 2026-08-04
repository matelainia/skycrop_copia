import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, X } from 'lucide-react';

/**
 * AgronomicTip
 * Dismissible green banner shown at the bottom of the dashboard.
 * Uses Framer Motion AnimatePresence for a smooth exit animation.
 *
 * @param {boolean}  visible   - controlled externally (useState in Dashboard)
 * @param {function} onDismiss - sets visible to false
 */
function AgronomicTip({ visible, onDismiss }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fert-tip"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Icon */}
          <div className="fert-tip__icon" aria-hidden="true">
            <Leaf size={20} />
          </div>

          {/* Content */}
          <div className="fert-tip__body">
            <div className="fert-tip__title">Consejo Agronómico</div>
            <p className="fert-tip__text">
              Para cultivos de <strong>Cacao en fase de floración</strong>, se recomienda aplicar
              fósforo (P) en dosis de 80–100 kg/ha para favorecer la formación de flores y mejorar
              la cuaja. Evite aplicaciones foliares durante lluvias intensas para maximizar la
              absorción radicular.
            </p>
          </div>

          {/* Dismiss button */}
          <button
            className="fert-tip__close"
            onClick={onDismiss}
            aria-label="Cerrar consejo agronómico"
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default React.memo(AgronomicTip);
