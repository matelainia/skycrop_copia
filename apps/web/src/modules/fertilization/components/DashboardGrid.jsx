import React from 'react';
import MetricCard from '../components/MetricCard.jsx';
import PlansTable from '../components/PlansTable.jsx';
import RecommendationPanel from '../components/RecommendationPanel.jsx';
import SoilAnalysisPanel from '../components/SoilAnalysisPanel.jsx';
import AgronomicTip from '../components/AgronomicTip.jsx';
import AIInsightsCard from '../components/AIInsightsCard.jsx';

/**
 * DashboardGrid
 * Widget-configurable layout engine for the Fertilización dashboard.
 *
 * The DASHBOARD_WIDGETS array in pages/Dashboard.jsx drives what renders here.
 * Adding a new widget = one new entry in that array, no changes needed here.
 *
 * Layout:
 *   Row 1: KPI metrics (4 columns)
 *   Row 2: 70/30 split
 *     Left (70%):  PlansTable
 *     Right (30%): RecommendationPanel + SoilAnalysisPanel + AIInsightsCard
 *   Row 3: AgronomicTip (full width)
 *
 * @param {object[]} widgets        - enabled widget config array
 * @param {object}   data           - { metrics, plans, recommendations, soilAnalysis }
 * @param {boolean}  tipVisible     - controlled by parent
 * @param {function} onDismissTip   - callback
 * @param {object}   handlers       - event handlers for table/panel actions
 */
function DashboardGrid({ widgets = [], data = {}, tipVisible, onDismissTip, handlers = {} }) {
  const isEnabled = (id) => widgets.find((w) => w.id === id)?.enabled !== false;

  const { metrics = [], plans = [], recommendations = [], soilAnalysis = [] } = data;

  return (
    <>
      {/* ── KPI Row ───────────────────────────────────────────────── */}
      {isEnabled('metrics') && (
        <div className="fert-kpi-grid" role="list" aria-label="Indicadores clave">
          {metrics.map((metric, index) => (
            <div key={metric.id} role="listitem">
              <MetricCard metric={metric} index={index} />
            </div>
          ))}
        </div>
      )}

      {/* ── Main 70/30 Grid ───────────────────────────────────────── */}
      <div className="fert-main-grid">
        {/* Left column — Plans Table */}
        <div className="fert-left-col">
          {isEnabled('plans') && (
            <PlansTable
              plans={plans}
              onViewAll={handlers.onViewAll}
              onViewAllFooter={handlers.onViewAllFooter}
              onViewPlan={handlers.onViewPlan}
              onEditPlan={handlers.onEditPlan}
              onCreatePlan={handlers.onCreatePlan}
            />
          )}
        </div>

        {/* Right column — Panels */}
        <div className="fert-right-col">
          {isEnabled('recommendations') && (
            <RecommendationPanel
              recommendations={recommendations}
              onViewCalendar={handlers.onViewCalendar}
            />
          )}
          {isEnabled('soilAnalysis') && (
            <SoilAnalysisPanel
              soilAnalysis={soilAnalysis}
              onViewAll={handlers.onViewAllSoil}
              onViewItem={handlers.onViewSoilItem}
            />
          )}
          {isEnabled('aiInsights') && <AIInsightsCard />}
        </div>
      </div>

      {/* ── Agronomic Tip (full width) ────────────────────────────── */}
      {isEnabled('agronomicTip') && (
        <AgronomicTip visible={tipVisible} onDismiss={onDismissTip} />
      )}
    </>
  );
}

export default React.memo(DashboardGrid);
