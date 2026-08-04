/**
 * PlansLoadingSkeleton.jsx  ·  components/plans/
 * Skeleton loader de 5 filas para la tabla de planes.
 * Sin spinner — anima con CSS pulse (reutiliza .fert-skeleton de fertilization.css).
 */
import React from 'react';

function SkeletonRow() {
  return (
    <tr className="plans-skeleton-row" aria-hidden="true">
      {/* Plan */}
      <td>
        <div className="plans-skeleton-cell">
          <div className="fert-skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div className="fert-skeleton fert-skeleton--text" style={{ width: '70%' }} />
            <div className="fert-skeleton fert-skeleton--text" style={{ width: '40%', height: 10 }} />
          </div>
        </div>
      </td>
      {/* Lote */}
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="fert-skeleton fert-skeleton--text" style={{ width: '60%' }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: '40%', height: 10 }} />
        </div>
      </td>
      {/* Cultivo */}
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="fert-skeleton fert-skeleton--text" style={{ width: '55%' }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: '70%', height: 10 }} />
        </div>
      </td>
      {/* Etapa */}
      <td>
        <div className="fert-skeleton" style={{ width: 100, height: 24, borderRadius: 999 }} />
      </td>
      {/* Fecha */}
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="fert-skeleton fert-skeleton--text" style={{ width: '60%' }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: '50%', height: 10 }} />
        </div>
      </td>
      {/* Estado */}
      <td>
        <div className="fert-skeleton" style={{ width: 80, height: 24, borderRadius: 999 }} />
      </td>
      {/* Acciones */}
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="fert-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div className="fert-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
        </div>
      </td>
    </tr>
  );
}

function PlansLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </>
  );
}

export default PlansLoadingSkeleton;
