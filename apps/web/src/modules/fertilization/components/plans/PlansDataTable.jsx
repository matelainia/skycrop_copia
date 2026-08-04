/**
 * PlansDataTable.jsx  ·  components/plans/
 * Tabla principal de planes de fertilización.
 *
 * Desktop: tabla completa con 7 columnas.
 * Mobile (<640px): cada fila se convierte en tarjeta (via CSS, no JS).
 *
 * @param {object[]} plans       - Planes UI-ready del hook
 * @param {boolean}  loading     - Estado de carga
 * @param {string|null} error    - Mensaje de error
 * @param {object}   handlers    - Todos los callbacks de acción del hook
 */
import React from 'react';
import PlanRow from './PlanRow.jsx';
import PlansLoadingSkeleton from './PlansLoadingSkeleton.jsx';
import EmptyPlansState from './EmptyPlansState.jsx';

const TABLE_HEADERS = [
  { key: 'name',              label: 'Plan de Fertilización' },
  { key: 'lot',               label: 'Predio / Lote / Sector' },
  { key: 'crop',              label: 'Cultivo' },
  { key: 'phenologicalStage', label: 'Etapa Fenológica' },
  { key: 'createdAt',         label: 'Fecha Creación' },
  { key: 'status',            label: 'Estado' },
  { key: 'actions',           label: 'Acciones' },
];

function PlansDataTable({ plans = [], loading = false, error = null, handlers = {} }) {
  return (
    <div className="plans-table-container">
      <div className="plans-table-wrapper" role="region" aria-label="Tabla de planes de fertilización">
        <table
          className="plans-table"
          role="table"
          aria-label="Planes de fertilización"
          aria-busy={loading}
        >
          <thead className="plans-table__head">
            <tr>
              {TABLE_HEADERS.map((h) => (
                <th
                  key={h.key}
                  scope="col"
                  className="plans-table__th"
                  data-col={h.key}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="plans-table__body">
            {loading ? (
              <PlansLoadingSkeleton />
            ) : error ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="plans-table__error-cell">
                  <div className="plans-table__error-msg">{error}</div>
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length} style={{ padding: 0 }}>
                  <EmptyPlansState onCreatePlan={handlers.onCreatePlan} />
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <PlanRow key={plan.id} plan={plan} handlers={handlers} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(PlansDataTable);
