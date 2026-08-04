import React from 'react';

/**
 * LoadingDashboard
 * Skeleton screens for the Fertilización dashboard.
 * Renders pulsing placeholders matching the real layout structure.
 */
export default function LoadingDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="fert-skeleton" style={{ width: 56, height: 56, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="fert-skeleton fert-skeleton--title" />
            <div className="fert-skeleton fert-skeleton--text" style={{ width: 280 }} />
          </div>
        </div>
        <div className="fert-skeleton" style={{ width: 180, height: 40, borderRadius: 16 }} />
      </div>

      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E7EB', paddingBottom: 12 }}>
        {[120, 160, 140, 120, 160, 100].map((w, i) => (
          <div key={i} className="fert-skeleton fert-skeleton--text" style={{ width: w, borderRadius: 4 }} />
        ))}
      </div>

      {/* KPI grid skeleton */}
      <div className="fert-kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fert-card fert-skeleton--card" style={{ height: 110 }} />
        ))}
      </div>

      {/* Main grid skeleton */}
      <div className="fert-main-grid">
        {/* Left — table */}
        <div className="fert-card fert-card--static" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="fert-skeleton fert-skeleton--text" style={{ width: 200 }} />
            <div className="fert-skeleton fert-skeleton--text" style={{ width: 120 }} />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="fert-skeleton fert-skeleton--row" style={{ marginBottom: 8 }} />
          ))}
        </div>

        {/* Right — panels */}
        <div className="fert-right-col">
          <div className="fert-card fert-card--static" style={{ height: 220 }} />
          <div className="fert-card fert-card--static" style={{ height: 120 }} />
        </div>
      </div>
    </div>
  );
}
