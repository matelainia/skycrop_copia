/**
 * PlanDetailLoadingSkeleton.jsx
 * Skeleton de carga para la pantalla de detalle del plan.
 * Usa clases sc-skeleton de fertilization-animations.css.
 */
import React from 'react';

function SkeletonKpi() {
  return (
    <div className="pd-kpi" aria-hidden="true">
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div className="sc-skeleton" style={{ width:80, height:10 }} />
        <div className="sc-skeleton" style={{ width:60, height:24 }} />
        <div className="sc-skeleton" style={{ width:100, height:10 }} />
      </div>
      <div className="sc-skeleton" style={{ width:40, height:40, borderRadius:12 }} />
    </div>
  );
}

function SkeletonObsCard() {
  return (
    <div className="pd-obs-card" aria-hidden="true" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div className="sc-skeleton" style={{ width:80, height:20, borderRadius:999 }} />
        <div className="sc-skeleton" style={{ width:100, height:20, borderRadius:999, marginLeft:'auto' }} />
      </div>
      <div className="sc-skeleton" style={{ width:'90%', height:13, marginBottom:6 }} />
      <div className="sc-skeleton" style={{ width:'70%', height:13 }} />
    </div>
  );
}

export default function PlanDetailLoadingSkeleton() {
  return (
    <div className="plan-detail" aria-busy="true" aria-label="Cargando plan de fertilización">
      {/* Header skeleton */}
      <div className="plan-detail__header" aria-hidden="true">
        <div style={{ display:'flex', alignItems:'flex-start', gap:16, flex:1 }}>
          <div className="sc-skeleton" style={{ width:48, height:48, borderRadius:14, flexShrink:0 }} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            <div className="sc-skeleton" style={{ width:120, height:10, borderRadius:6 }} />
            <div className="sc-skeleton" style={{ width:'60%', height:24, borderRadius:8 }} />
            <div style={{ display:'flex', gap:8 }}>
              <div className="sc-skeleton" style={{ width:80, height:20, borderRadius:999 }} />
              <div className="sc-skeleton" style={{ width:100, height:20, borderRadius:999 }} />
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div className="sc-skeleton" style={{ width:80, height:80, borderRadius:'50%' }} />
          <div className="sc-skeleton" style={{ width:110, height:36, borderRadius:10 }} />
        </div>
      </div>

      {/* KPI skeletons */}
      <div className="plan-detail__kpis" aria-hidden="true">
        {[1,2,3,4].map(i => <SkeletonKpi key={i} />)}
      </div>

      {/* Content grid skeleton */}
      <div className="plan-detail__grid" aria-hidden="true">
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* General info */}
          <div className="pd-card">
            <div className="pd-card__header">
              <div className="sc-skeleton" style={{ width:140, height:14 }} />
              <div className="sc-skeleton" style={{ width:80, height:12 }} />
            </div>
            <div className="pd-card__body">
              <div className="pd-general-grid">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="pd-field">
                    <div className="sc-skeleton" style={{ width:60, height:10, marginBottom:4 }} />
                    <div className="sc-skeleton" style={{ width:'80%', height:14 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Observations skeleton */}
          <div className="pd-card">
            <div className="pd-card__header">
              <div className="sc-skeleton" style={{ width:140, height:14 }} />
            </div>
            <div className="pd-card__body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <SkeletonObsCard />
              <SkeletonObsCard />
              <SkeletonObsCard />
            </div>
          </div>
        </div>

        {/* Sidebar skeletons */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {[1,2,3].map(i => (
            <div key={i} className="pd-card" aria-hidden="true">
              <div className="pd-card__header">
                <div className="sc-skeleton" style={{ width:120, height:14 }} />
              </div>
              <div className="pd-card__body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2,3,4].map(j => (
                  <div key={j} style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div className="sc-skeleton" style={{ width:28, height:28, borderRadius:8, flexShrink:0 }} />
                    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                      <div className="sc-skeleton" style={{ width:'40%', height:10 }} />
                      <div className="sc-skeleton" style={{ width:'80%', height:6, borderRadius:999 }} />
                    </div>
                    <div className="sc-skeleton" style={{ width:40, height:18, borderRadius:999 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
