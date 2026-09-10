import React from 'react';
import HarvestModule from '../../modules/harvest/HarvestModule';

/**
 * Cosecha y Postcosecha — capa operativa sobre datos reales
 * Delega al módulo harvest (arquitectura: UI -> hooks -> services -> Supabase/backend).
 * Cero datos mock: si no hay registros muestra empty-state, nunca inventa Cosecha #001.
 */
export default function CosechaPostcosecha() {
  return <HarvestModule />;
}
