import { memo } from 'react';

function SkeletonRow() {
  return (
    <tr className="plans-skeleton-row" aria-hidden="true">
      <td><div className="fert-skeleton fert-skeleton--text" style={{ width: 90, height: 12 }} /></td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 110, height: 12 }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 70, height: 9, opacity: 0.7 }} />
        </div>
      </td>
      <td><div className="fert-skeleton fert-skeleton--text" style={{ width: 80, height: 12 }} /></td>
      <td><div className="fert-skeleton" style={{ width: 110, height: 22, borderRadius: 999 }} /></td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 90, height: 11 }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 90, height: 11 }} />
        </div>
      </td>
      <td><div className="fert-skeleton fert-skeleton--text" style={{ width: 60, height: 12 }} /></td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 70, height: 10 }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 70, height: 10 }} />
          <div className="fert-skeleton fert-skeleton--text" style={{ width: 70, height: 10 }} />
        </div>
      </td>
      <td><div className="fert-skeleton" style={{ width: 90, height: 22, borderRadius: 999 }} /></td>
      <td><div className="fert-skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} /></td>
    </tr>
  );
}

const AplicacionesSkeleton = memo(function AplicacionesSkeleton({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </>
  );
});

export default AplicacionesSkeleton;
