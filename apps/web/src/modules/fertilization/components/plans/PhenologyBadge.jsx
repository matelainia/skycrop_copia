/**
 * PhenologyBadge.jsx  ·  components/plans/
 * Badge de etapa fenológica con color por etapa.
 *
 * Las etapas son relacionales por cultivo (vía phenologicalStageId).
 * Este componente recibe el label ya resuelto por el DTO.
 *
 * @param {string} stage - Label de la etapa (ej. "Floración", "Cherelle")
 * @param {string} [className]
 */
import React from 'react';

// Mapa de etapa → variante CSS.
// Cultivos distintos pueden tener etapas distintas; el fallback cubre las nuevas.
const STAGE_VARIANT_MAP = {
  // Floración (todos los cultivos)
  'floración':           'phenology-badge--floracion',
  'floración':           'phenology-badge--floracion',
  // Desarrollo Vegetativo / Vegetativo
  'desarrollo vegetativo': 'phenology-badge--vegetativo',
  // Fructificación / Cuajado / Cherelle / Llenado
  'fructificación':      'phenology-badge--fructificacion',
  'cuajado':             'phenology-badge--fructificacion',
  'cherelle':            'phenology-badge--fructificacion',
  'llenado':             'phenology-badge--llenado',
  'llenado de fruta':    'phenology-badge--llenado',
  // Renovación / Granado
  'renovación':          'phenology-badge--renovacion',
  'granado':             'phenology-badge--renovacion',
  // Producción / Inflorescencia / Madurez / Maduración
  'producción':          'phenology-badge--produccion',
  'inflorescencia':      'phenology-badge--produccion',
  'madurez':             'phenology-badge--maduracion',
  'maduración':          'phenology-badge--maduracion',
  // Emisión (banano)
  'emisión':             'phenology-badge--emision',
};

function getVariant(stage) {
  if (!stage) return 'phenology-badge--default';
  return STAGE_VARIANT_MAP[stage.toLowerCase()] ?? 'phenology-badge--default';
}

const PhenologyBadge = React.memo(function PhenologyBadge({ stage, className = '' }) {
  if (!stage) return null;
  const variant = getVariant(stage);
  return (
    <span className={`phenology-badge ${variant} ${className}`}>
      {stage}
    </span>
  );
});

export default PhenologyBadge;
