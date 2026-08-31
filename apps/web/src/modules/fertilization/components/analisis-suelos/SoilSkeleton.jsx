import { memo } from 'react';

const SoilSkeleton = memo(function SoilSkeleton({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="soil-table__row" aria-hidden="true">
          <td className="soil-table__td" colSpan={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="soil-skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="soil-skeleton" style={{ height: 12, width: '70%', maxWidth: 220 }} />
                <div className="soil-skeleton" style={{ height: 10, width: '40%', maxWidth: 140 }} />
              </div>
              <div className="soil-skeleton" style={{ width: 80, height: 20, borderRadius: 999 }} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
});

export default SoilSkeleton;

export const MetricsSkeleton = memo(function MetricsSkeleton() {
  return (
    <div className="soil-metrics">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="soil-metric-card">
          <div className="soil-skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="soil-skeleton" style={{ height: 16, width: 50 }} />
            <div className="soil-skeleton" style={{ height: 10, width: 100 }} />
          </div>
        </div>
      ))}
    </div>
  );
});
