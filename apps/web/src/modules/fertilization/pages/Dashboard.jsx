/**
 * Dashboard.jsx — Main Master Page for Fertilización Module
 *
 * Tabs: Resumen | Planes | Recomendaciones | Aplicaciones | Análisis de Suelos | Calculadora
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
import CalculadoraPage from '../components/calculadora/CalculadoraPage.jsx';

// Recommendations Component
import RecommendationsDashboard from '../components/recommendations/RecommendationsDashboard.jsx';
import { FertilizationWizardModal } from '../components/wizard/FertilizationWizardModal.jsx';
import AplicacionesPage from '../components/aplicaciones/AplicacionesPage.jsx';
import SoilAnalysisPage from '../components/analisis-suelos/SoilAnalysisPage.jsx';
import '../styles/soilAnalysis.css';

const DASHBOARD_WIDGETS = [
  { id: 'metrics', enabled: true, label: 'KPIs' },
  { id: 'plans', enabled: true, label: 'Planes de Fertilización' },
  { id: 'recommendations', enabled: true, label: 'Próximas Recomendaciones' },
  { id: 'soilAnalysis', enabled: true, label: 'Análisis de Suelos' },
  { id: 'agronomicTip', enabled: true, label: 'Consejo Agronómico' },
  { id: 'aiInsights', enabled: true, label: 'IA Agronómica' },
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

  const [aplicacionesNewTrigger, setAplicacionesNewTrigger] = useState(0);
  const handleNewAplicacionFromHeader = useCallback(() => {
    setActiveTab('aplicaciones');
    // Dispara apertura del drawer real (comunicación por props)
    setAplicacionesNewTrigger((v) => v + 1);
    console.info('[Fertilización] Nueva Aplicación solicitada desde header — RLS por empresa');
  }, []);

  const [soilNewTrigger, setSoilNewTrigger] = useState(0);
  const handleNewSoilFromHeader = useCallback(() => {
    setActiveTab('analisis-suelos');
    setSoilNewTrigger((v) => v + 1);
    console.info('[Análisis de Suelos] Nuevo análisis solicitado desde header — RLS por empresa/predio');
  }, []);

  return (
    <div className="fert-module" id="fertilizacion-dashboard">

      {/* Header */}
      <DashboardHeader
        activeTab={activeTab}
        onNewRecommendation={handlers.onNewRecommendation}
        onNewPlan={handlers.onCreatePlan}
        onNewAplicacion={handleNewAplicacionFromHeader}
        onNewAnalisisSuelo={handleNewSoilFromHeader}
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

        {/* TAB: APLICACIONES — Implementación completa (cero mocks) */}
        {activeTab === 'aplicaciones' && (
          <AplicacionesPage
            externalOpenTrigger={aplicacionesNewTrigger}
            onNewAplicacion={() => {
              console.info('[Fertilización] Nueva Aplicación: flujo manual iniciado — empresa aislada por RLS');
            }}
            onViewGuide={() => console.info('[Fertilización] Ver Guía de Aplicaciones')}
          />
        )}

        {/* TAB: ANÁLISIS DE SUELOS — Implementación completa (cero mocks) */}
        {activeTab === 'analisis-suelos' && (
          <SoilAnalysisPage externalOpenTrigger={soilNewTrigger} />
        )}

        {/* TAB: CALCULADORA DE FERTILIZACIÓN */}
        {activeTab === 'calculadora' && (
          <CalculadoraPage />
        )}
      </div>

    </div>
  );
}
