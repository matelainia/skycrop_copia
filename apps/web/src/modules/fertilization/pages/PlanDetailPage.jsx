/**
 * PlanDetailPage.jsx
 * Página raíz de la vista de detalle del plan de fertilización.
 *
 * Recibe:
 *   - planId  {string}   UUID del plan a visualizar
 *   - onBack  {function} Callback para volver al listado de planes
 *
 * Orquesta todos los sub-componentes:
 *   Header → KPIs → [Main col: Info, Items, Timeline, Feed] + [Sidebar: Next, Nutrition, Alerts, Conditions]
 */
import { CheckCircle2, XCircle } from 'lucide-react';

import { usePlanDetail } from '../hooks/usePlanDetail.js';

// Importar estilos de animaciones y del módulo
import '../components/detail/fertilization-animations.css';
import '../styles/plan-detail.css';

// Componentes
import PlanDetailLoadingSkeleton        from '../components/detail/PlanDetailLoadingSkeleton.jsx';
import PlanDetailHeader                 from '../components/detail/PlanDetailHeader.jsx';
import PlanDetailKpis                   from '../components/detail/PlanDetailKpis.jsx';
import PlanDetailGeneralInfo            from '../components/detail/PlanDetailGeneralInfo.jsx';
import PlanDetailItemsTable             from '../components/detail/PlanDetailItemsTable.jsx';
import PlanDetailApplicationTimeline    from '../components/detail/PlanDetailApplicationTimeline.jsx';
import PlanDetailObservationFeed        from '../components/detail/PlanDetailObservationFeed.jsx';
import PlanDetailNutritionPanel         from '../components/detail/PlanDetailNutritionPanel.jsx';
import PlanDetailNextApplication        from '../components/detail/PlanDetailNextApplication.jsx';
import PlanDetailActiveAlerts           from '../components/detail/PlanDetailActiveAlerts.jsx';
import PlanDetailFieldConditions        from '../components/detail/PlanDetailFieldConditions.jsx';

export default function PlanDetailPage({ planId, onBack }) {
  const {
    detail,
    loading,
    error,
    mutating,
    handleSaveObservation,
    handleAddComment,
    handleCompleteApplication,
    handleExportPdf,
    toast,
  } = usePlanDetail(planId);

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="plan-detail" role="alert" aria-live="assertive">
        <div className="pd-card" style={{ padding:'48px 24px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
          <h2 style={{ fontFamily:'var(--font-display)', marginBottom:8 }}>No se pudo cargar el plan</h2>
          <p style={{ color:'var(--pd-secondary)', marginBottom:20 }}>{error}</p>
          <button className="pd-btn pd-btn--primary" onClick={onBack} id="plan-detail-error-back-btn">
            Volver a Fertilización
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return <PlanDetailLoadingSkeleton />;
  }

  const { plan, items, applications, nextApp, observations, alerts, fieldCondition, nutrition } = detail;

  // ── Last foliar date ─────────────────────────────────────────────────────────
  const lastFoliarDate = observations?.find(o => o.observation_type === 'foliar_analysis')?.observed_at;

  return (
    <main className="plan-detail" aria-label={`Detalle del plan: ${plan.name}`}>
      {/* HEADER */}
      <PlanDetailHeader
        plan={plan}
        onBack={onBack}
        onExportPdf={handleExportPdf}
        exporting={mutating}
      />

      {/* KPIs */}
      <PlanDetailKpis plan={plan} />

      {/* GRID PRINCIPAL: 2 columnas */}
      <div className="plan-detail__grid">

        {/* Columna principal */}
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--pd-gap)' }}>
          <PlanDetailGeneralInfo plan={plan} />
          <PlanDetailItemsTable  items={items} />
          <PlanDetailApplicationTimeline
            applications={applications}
            onComplete={handleCompleteApplication}
            mutating={mutating}
          />
          <PlanDetailObservationFeed
            observations={observations}
            onAddComment={handleAddComment}
            onSaveObservation={handleSaveObservation}
            mutating={mutating}
          />
        </div>

        {/* Sidebar */}
        <aside style={{ display:'flex', flexDirection:'column', gap:'var(--pd-gap)' }} aria-label="Panel lateral del plan">
          <PlanDetailNextApplication
            nextApp={nextApp}
            onComplete={handleCompleteApplication}
            mutating={mutating}
          />
          <PlanDetailNutritionPanel
            nutrition={nutrition}
            lastAnalysisDate={lastFoliarDate}
          />
          <PlanDetailActiveAlerts alerts={alerts} />
          <PlanDetailFieldConditions fieldCondition={fieldCondition} />
        </aside>
      </div>

      {/* TOAST notifications */}
      {toast && (
        <div className="pd-toast-container" role="status" aria-live="polite">
          <div className={`pd-toast sc-toast pd-toast--${toast.type}`}>
            {toast.type === 'success'
              ? <CheckCircle2 size={16} aria-hidden="true" />
              : <XCircle size={16} aria-hidden="true" />
            }
            {toast.message}
          </div>
        </div>
      )}
    </main>
  );
}
