/**
 * Dashboard.jsx — Main Master Page for Fertilización Module
 * 
 * Main menu tabs: Resumen, Planes de Fertilización, Recomendaciones, Aplicaciones, Análisis de Suelos, Historial.
 */

import React, { useState, useCallback } from 'react';
import '../styles/fertilization.css';

import { useFertilizationDashboard } from '../hooks/useFertilizationDashboard.js';

// Header & Tabs
import DashboardHeader from '../components/DashboardHeader.jsx';
import FertTabs from '../components/FertTabs.jsx';
import DashboardGrid from '../components/DashboardGrid.jsx';
import LoadingDashboard from '../components/states/LoadingDashboard.jsx';
import ErrorDashboard from '../components/states/ErrorDashboard.jsx';
import FertilizationPlansPage from './FertilizationPlansPage.jsx';
import PlanDetailPage from './PlanDetailPage.jsx';

// Recommendations Component
import RecommendationsDashboard from '../components/recommendations/RecommendationsDashboard.jsx';
import { FertilizationWizardModal } from '../components/wizard/FertilizationWizardModal.jsx';

const DASHBOARD_WIDGETS = [
  { id: 'metrics',         enabled: true,  label: 'KPIs' },
  { id: 'plans',           enabled: true,  label: 'Planes de Fertilización' },
  { id: 'recommendations', enabled: true,  label: 'Próximas Recomendaciones' },
  { id: 'soilAnalysis',    enabled: true,  label: 'Análisis de Suelos' },
  { id: 'agronomicTip',    enabled: true,  label: 'Consejo Agronómico' },
  { id: 'aiInsights',      enabled: true,  label: 'IA Agronómica' },
];

export default function Dashboard() {
  const { metrics, plans, recommendations, soilAnalysis, loading, error, refetch } =
    useFertilizationDashboard();

  const [activeTab, setActiveTab] = useState('recomendaciones'); // Default to Recomendaciones tab
  const [tipVisible, setTipVisible] = useState(true);
  const [activePlanId, setActivePlanId] = useState(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handlers = {
    onNewRecommendation: useCallback(() => {
      setActiveTab('recomendaciones');
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

  return (
    <div className="fert-module" id="fertilizacion-dashboard">
      
      {/* Header */}
      <DashboardHeader
        activeTab={activeTab}
        onNewRecommendation={handlers.onNewRecommendation}
        onNewPlan={handlers.onCreatePlan}
      />

      {/* Shared Wizard Modal */}
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

      {/* Main Navigation Tabs */}
      <FertTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id={`fert-tabpanel-${activeTab}`}
        aria-labelledby={`fert-tab-${activeTab}`}
        style={{ marginTop: '16px' }}
      >
        {/* TAB 1: RESUMEN */}
        {activeTab === 'resumen' && (
          <>
            {loading && <LoadingDashboard />}
            {!loading && error && <ErrorDashboard error={error} onRetry={refetch} />}
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
        )}

        {/* TAB 2: PLANES DE FERTILIZACIÓN */}
        {activeTab === 'planes' && (
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
        )}

        {/* TAB 3: RECOMENDACIONES */}
        {activeTab === 'recomendaciones' && (
          <RecommendationsDashboard
            onOpenWizard={() => setIsWizardOpen(true)}
            onViewDetail={(item) => console.info('Ver detalle:', item.id)}
          />
        )}

        {/* OTROS TABS */}
        {(activeTab === 'aplicaciones' || activeTab === 'analisis-suelos' || activeTab === 'historial') && (
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
              background: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
            }}
          >
            <div style={{ fontSize: 48 }}>🌱</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
              Sección de {activeTab.replace('-', ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 14 }}>
              Esta sección está integrada con el módulo principal de Fertilización.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
