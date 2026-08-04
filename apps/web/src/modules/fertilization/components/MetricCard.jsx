import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, FlaskConical, Droplets, TrendingUp } from 'lucide-react';

/**
 * Icon map — resolves icon name from mock data to Lucide component.
 * Add new icons here when extending metrics.
 */
const ICON_MAP = {
  Sprout,
  Flask: FlaskConical,
  Droplets,
  TrendingUp,
};

const TILE_COLOR_MAP = {
  Sprout:     'green',
  Flask:      'blue',
  Droplets:   'cyan',
  TrendingUp: 'orange',
};

/**
 * MetricCard
 * 110px KPI card: icon tile + large number + label + colored note.
 *
 * @param {object} metric  - from mockDashboard.metrics[]
 * @param {number} index   - used for stagger animation delay
 */
const MetricCard = React.memo(function MetricCard({ metric, index = 0 }) {
  const Icon = ICON_MAP[metric.icon] ?? Sprout;
  const tileColor = TILE_COLOR_MAP[metric.icon] ?? 'green';

  return (
    <motion.div
      className="fert-card fert-metric-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      {/* Icon tile */}
      <div
        className={`fert-metric-card__icon-tile fert-metric-card__icon-tile--${tileColor}`}
        aria-hidden="true"
      >
        <Icon size={22} />
      </div>

      {/* Content */}
      <div className="fert-metric-card__body">
        <div className="fert-metric-card__value">
          {metric.value.toLocaleString('es-ES')}
          {metric.unit && (
            <span className="fert-metric-card__unit">{metric.unit}</span>
          )}
        </div>
        <div className="fert-metric-card__label">{metric.label}</div>
        {metric.note && (
          <div className={`fert-metric-card__note fert-metric-card__note--${metric.noteColor}`}>
            {metric.note}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default MetricCard;
