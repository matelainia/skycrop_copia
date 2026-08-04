/**
 * PlanRow.jsx  ·  components/plans/
 * Fila de tabla para un plan de fertilización.
 *
 * Columnas:
 *   1. Plan (icono doc + nombre + código + versión)
 *   2. Predio / Lote / Sector
 *   3. Cultivo (nombre + nombre científico)
 *   4. Etapa Fenológica (PhenologyBadge)
 *   5. Fecha Creación (fecha + usuario)
 *   6. Estado de Trabajo (StatusBadge type="plan")
 *   7. Acciones (Eye + ActionsDropdown)
 *
 * @param {object}   plan     - Plan UI-ready del service
 * @param {object}   handlers - Todos los callbacks de acción
 */
import React from 'react';
import { Eye, FileText } from 'lucide-react';
import PhenologyBadge from './PhenologyBadge.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import ActionsDropdown from './ActionsDropdown.jsx';

const PlanRow = React.memo(function PlanRow({ plan, handlers }) {
  return (
    <tr className="plans-table__row">
      {/* ── Columna 1: Plan ─────────────────────────────────────────────── */}
      <td className="plans-table__td">
        <div className="plan-cell">
          <div className="plan-cell__icon" aria-hidden="true">
            <FileText size={16} />
          </div>
          <div className="plan-cell__info">
            <div className="plan-cell__name">
              {plan.name}
              {plan.isVersioned && (
                <span className="plan-cell__version-badge">{plan.version}</span>
              )}
            </div>
            <div className="plan-cell__code">{plan.code}</div>
          </div>
        </div>
      </td>

      {/* ── Columna 2: Predio / Lote / Sector ───────────────────────────── */}
      <td className="plans-table__td">
        <div className="lot-cell__name">{plan.lotName}</div>
        <div className="lot-cell__sector">{plan.sectorName}</div>
      </td>

      {/* ── Columna 3: Cultivo ──────────────────────────────────────────── */}
      <td className="plans-table__td">
        <div className="crop-cell__name">{plan.cropName}</div>
        <div className="crop-cell__scientific">({plan.scientificName})</div>
      </td>

      {/* ── Columna 4: Etapa Fenológica ────────────────────────────────── */}
      <td className="plans-table__td">
        <PhenologyBadge stage={plan.phenologicalLabel || plan.phenologicalStage} />
      </td>

      {/* ── Columna 5: Fecha Creación ──────────────────────────────────── */}
      <td className="plans-table__td">
        <div className="date-cell__date">{plan.createdAtFormatted}</div>
        <div className="date-cell__user">{plan.createdBy?.name}</div>
      </td>

      {/* ── Columna 6: Estado ──────────────────────────────────────────── */}
      <td className="plans-table__td">
        <StatusBadge status={plan.status} type="plan" />
      </td>

      {/* ── Columna 7: Acciones ────────────────────────────────────────── */}
      <td className="plans-table__td plans-table__td--actions">
        <div className="row-actions">
          <button
            className="fert-btn fert-btn--ghost fert-btn--icon"
            onClick={() => handlers.onView?.(plan)}
            aria-label={`Ver detalle de ${plan.name}`}
            id={`plan-view-btn-${plan.id}`}
          >
            <Eye size={16} />
          </button>
          <ActionsDropdown plan={plan} handlers={handlers} />
        </div>
      </td>
    </tr>
  );
});

export default PlanRow;
