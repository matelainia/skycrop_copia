import React, { useState, useMemo } from 'react';
import { Eye, Pencil } from 'lucide-react';
import EmptyPlans from './states/EmptyPlans.jsx';

/**
 * Returns the badge variant class for a fertilizer string.
 */
function getFertilizerBadge(fertilizer = '') {
  const f = fertilizer.toLowerCase();
  if (f.includes('npk')) return 'npk';
  if (f.includes('urea')) return 'urea';
  if (f.includes('kcl')) return 'kcl';
  if (f.includes('dap')) return 'dap';
  return 'info';
}

/**
 * LotAvatar — initials placeholder using the deriveLotInitials field from planModel.
 */
function LotAvatar({ plan }) {
  const lotIndex = plan.lotId?.replace('lot-', '') ?? '0';
  return (
    <div
      className={`fert-avatar fert-avatar--lot-${lotIndex}`}
      aria-label={`Lote ${plan.lotName}`}
      title={plan.lotName}
    >
      {plan.lotInitials}
    </div>
  );
}

/**
 * PlanRow — memoized table row for a single plan.
 */
const PlanRow = React.memo(function PlanRow({ plan, onView, onEdit }) {
  return (
    <tr>
      {/* Lote / Sector */}
      <td>
        <div className="fert-table-lot-cell">
          <LotAvatar plan={plan} />
          <div>
            <div className="fert-table-lot-info__name">{plan.lotName}</div>
            <div className="fert-table-lot-info__meta">{plan.lotArea}</div>
          </div>
        </div>
      </td>

      {/* Cultivo */}
      <td>
        <div className="fert-table-crop__name">{plan.crop}</div>
        <div className="fert-table-crop__variety">{plan.variety}</div>
      </td>

      {/* Fase fenológica */}
      <td style={{ fontSize: 14, color: '#374151' }}>{plan.phenologicalPhase}</td>

      {/* Última recomendación */}
      <td>
        <div className="fert-table-rec__date">{plan.lastRecommendationFormatted}</div>
        <div className="fert-table-rec__fertilizer">{plan.lastFertilizer}</div>
      </td>

      {/* Estado */}
      <td>
        <span className={`fert-badge fert-badge--${plan.statusVariant}`}>
          {plan.statusLabel}
        </span>
      </td>

      {/* Acciones */}
      <td>
        <div className="fert-table-actions">
          <button
            className="fert-btn fert-btn--ghost fert-btn--icon"
            onClick={() => onView?.(plan)}
            aria-label={`Ver plan de ${plan.lotName}`}
          >
            <Eye size={16} />
          </button>
          <button
            className="fert-btn fert-btn--ghost fert-btn--icon"
            onClick={() => onEdit?.(plan)}
            aria-label={`Editar plan de ${plan.lotName}`}
          >
            <Pencil size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
});

/**
 * PlansTable
 * Main left-column table with lot filter, 6 columns, and "Ver todos" footer.
 *
 * @param {array}    plans           - transformed plan objects from the hook
 * @param {function} onViewAll       - callback for "Ver todos" header link
 * @param {function} onViewAllFooter - callback for "Ver todos los planes" footer
 * @param {function} onViewPlan      - callback for Eye icon
 * @param {function} onEditPlan      - callback for Pencil icon
 * @param {function} onCreatePlan    - passed to EmptyPlans CTA
 */
function PlansTable({
  plans = [],
  onViewAll,
  onViewAllFooter,
  onViewPlan,
  onEditPlan,
  onCreatePlan,
}) {
  const [lotFilter, setLotFilter] = useState('all');

  // Memoize unique lot options
  const lotOptions = useMemo(() => {
    const unique = [...new Set(plans.map((p) => p.lotName))];
    return unique;
  }, [plans]);

  // Memoize filtered plans
  const filteredPlans = useMemo(() => {
    if (lotFilter === 'all') return plans;
    return plans.filter((p) => p.lotName === lotFilter);
  }, [plans, lotFilter]);

  return (
    <div className="fert-card fert-card--static">
      {/* Panel header */}
      <div className="fert-panel-header">
        <span className="fert-panel-title">Planes de Fertilización Activos</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Lot filter dropdown */}
          <select
            className="fert-dropdown"
            value={lotFilter}
            onChange={(e) => setLotFilter(e.target.value)}
            aria-label="Filtrar por lote"
          >
            <option value="all">Todos los lotes</option>
            {lotOptions.map((lot) => (
              <option key={lot} value={lot}>{lot}</option>
            ))}
          </select>

          <button
            className="fert-btn fert-btn--outline"
            onClick={onViewAll}
            aria-label="Ver todos los planes de fertilización"
          >
            Ver todos
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="fert-table-wrapper">
        {filteredPlans.length === 0 ? (
          <EmptyPlans onCreatePlan={onCreatePlan} />
        ) : (
          <table className="fert-table" role="table" aria-label="Planes de fertilización activos">
            <thead>
              <tr>
                <th scope="col">Lote / Sector</th>
                <th scope="col">Cultivo</th>
                <th scope="col">Fase Fenológica</th>
                <th scope="col">Última Recomendación</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  onView={onViewPlan}
                  onEdit={onEditPlan}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {filteredPlans.length > 0 && (
        <div className="fert-table-footer">
          <button
            className="fert-table-footer-btn"
            onClick={onViewAllFooter}
            aria-label="Ver todos los planes de fertilización"
          >
            Ver todos los planes
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(PlansTable);
