/**
 * Dashboard.jsx  ·  pages/
 *
 * Main page for the Fertilización module.
 * Self-contained: imports its own CSS — no global @import needed.
 *
 * Widget configuration:
 *   Add/remove/reorder widgets here. DashboardGrid renders only enabled ones.
 *   Future widgets (Balance Nutricional, Costos, etc.) = new entry in this array.
 */

import { useState, useCallback } from 'react';
import '../styles/fertilization.css';

import { useFertilizationDashboard } from '../hooks/useFertilizationDashboard.js';

// Components
import DashboardHeader from '../components/DashboardHeader.jsx';
import FertTabs from '../components/FertTabs.jsx';
import DashboardGrid from '../components/DashboardGrid.jsx';
import LoadingDashboard from '../components/states/LoadingDashboard.jsx';
import ErrorDashboard from '../components/states/ErrorDashboard.jsx';
import FertilizationPlansPage from './FertilizationPlansPage.jsx';
import PlanDetailPage from './PlanDetailPage.jsx';
import { FertilizationWizardModal } from '../components/wizard/FertilizationWizardModal.jsx';


// ─── Widget Registry ──────────────────────────────────────────────────────────
// To add a new widget: add an entry here. No other file needs to change.
const DASHBOARD_WIDGETS = [
  { id: 'metrics',         enabled: true,  label: 'KPIs' },
  { id: 'plans',           enabled: true,  label: 'Planes de Fertilización' },
  { id: 'recommendations', enabled: true,  label: 'Próximas Recomendaciones' },
  { id: 'soilAnalysis',    enabled: true,  label: 'Análisis de Suelos' },
  { id: 'agronomicTip',    enabled: true,  label: 'Consejo Agronómico' },
  { id: 'aiInsights',      enabled: true,  label: 'IA Agronómica' },
  // Future widgets — uncomment when ready:
  // { id: 'nutritionBalance', enabled: false, label: 'Balance Nutricional' },
  // { id: 'fertCosts',        enabled: false, label: 'Costos de Fertilización' },
  // { id: 'phenoStatus',      enabled: false, label: 'Estado Fenológico' },
];

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const { metrics, plans, recommendations, soilAnalysis, loading, error, refetch } =
    useFertilizationDashboard();

  // ── Local state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('resumen');
  const [tipVisible, setTipVisible] = useState(true);
  /** ID del plan activo en la vista de detalle. null = mostrar listado. */
  const [activePlanId, setActivePlanId] = useState(null);
  /** Estado del modal del Asistente Wizard */
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // ── Event handlers (memoized — no unnecessary re-renders on child props) ────
  const handlers = {
    onNewRecommendation: useCallback(() => {
      setIsWizardOpen(true);
    }, []),
    onViewAll: useCallback(() => {
      setActiveTab('planes');
    }, []),
    onViewAllFooter: useCallback(() => {
      setActiveTab('planes');
    }, []),
    onViewPlan: useCallback((plan) => {
      setActivePlanId(plan.id);
      setActiveTab('planes');
    }, []),
    onEditPlan: useCallback((plan) => {
      console.info('[Fertilización] Editar plan:', plan.id);
    }, []),

    onCreatePlan: useCallback(() => {
      setIsWizardOpen(true);
    }, []),
    onViewCalendar: useCallback(() => {
      setActiveTab('recomendaciones');
    }, []),
    onViewAllSoil: useCallback(() => {
      setActiveTab('analisis-suelos');
    }, []),
    onViewSoilItem: useCallback((analysis) => {
      console.info('[Fertilización] Ver análisis:', analysis.id);
    }, []),
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fert-module" id="fertilizacion-dashboard">
      {/* Header — always rendered (not a widget, structural element) */}
      <DashboardHeader
        activeTab={activeTab}
        onNewRecommendation={handlers.onNewRecommendation}
        onNewPlan={handlers.onCreatePlan}
      />

      {/* Wizard Modal */}
      <FertilizationWizardModal
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCreated={(newPlan) => {
          setIsWizardOpen(false);
          refetch();
          if (newPlan?.id) {
            setActivePlanId(newPlan.id);
            setActiveTab('planes');
          }
        }}
      />

      {/* Tabs — always rendered */}
      <FertTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab panel — "Resumen" is the only implemented tab today */}
      <div
        role="tabpanel"
        id={`fert-tabpanel-${activeTab}`}
        aria-labelledby={`fert-tab-${activeTab}`}
      >
        {activeTab === 'resumen' ? (
          <>
            {/* Loading state */}
            {loading && <LoadingDashboard />}

            {/* Error state */}
            {!loading && error && (
              <ErrorDashboard error={error} onRetry={refetch} />
            )}

            {/* Dashboard content */}
            {!loading && !error && (
              <DashboardGrid
                widgets={DASHBOARD_WIDGETS}
                data={{ metrics, plans, recommendations, soilAnalysis }}
                tipVisible={tipVisible}
                onDismissTip={() => setTipVisible(false)}
                handlers={handlers}
              />
            )}
          </>
        ) : activeTab === 'planes' ? (
          /* Si hay un plan activo, mostrar detalle; si no, el listado */
          activePlanId ? (
            <PlanDetailPage
              planId={activePlanId}
              onBack={() => setActivePlanId(null)}
            />
          ) : (
            <FertilizationPlansPage
              onViewPlan={(plan) => setActivePlanId(plan.id)}
            />
          )
        ) : (
          /* Placeholder for remaining non-implemented tabs */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 32px',
              gap: 12,
              color: '#6B7280',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ fontSize: 48 }}>🌱</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
              Sección en construcción
            </div>
            <div style={{ fontSize: 14 }}>
              Esta sección estará disponible próximamente.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

