import { useCallback, useEffect, useMemo } from 'react';
import MachineryProvider from './context/MachineryProvider';
import useMachinery from './hooks/useMachinery';
import useCurrentOperation from './hooks/useCurrentOperation';
import useMaintenance from './hooks/useMaintenance';
import MachineryHeader from './components/MachineryHeader';
import MachineryTabs from './components/MachineryTabs';
import { normalizeMachineryTab } from './constants/machineryTabs';
import { canCreateMachine } from './permissions/canCreateMachine';
import FlotaPage from './pages/FlotaPage';
import OperacionesPage from './pages/OperacionesPage';
import MantenimientosPage from './pages/MantenimientosPage';
import CombustiblePage from './pages/CombustiblePage';
import HistorialPage from './pages/HistorialPage';
import CostosPage from './pages/CostosPage';
import AlertasPage from './pages/AlertasPage';
import ReportesPage from './pages/ReportesPage';
import './components/MachineryModule.css';

function readTabFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab');
  } catch {
    return null;
  }
}

function writeTabToUrl(tab) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Sin History API (tests/SSR): no es crítico.
  }
}

function readMachineFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('machine');
  } catch {
    return null;
  }
}

function MaquinariaShell({ subTab, setSubTab }) {
  const machineryHook = useMachinery();
  const operationHook = useCurrentOperation();
  const maintenanceHook = useMaintenance();

  const activeTab = useMemo(() => normalizeMachineryTab(subTab), [subTab]);

  const changeTab = useCallback(
    (next) => {
      const normalized = normalizeMachineryTab(next);
      if (typeof setSubTab === 'function') {
        setSubTab(normalized);
      }
      writeTabToUrl(normalized);
    },
    [setSubTab],
  );

  // Sincronizar ?tab= inicial (deep-link / refresh sin perder contexto).
  useEffect(() => {
    const urlTab = normalizeMachineryTab(readTabFromUrl());
    const current = normalizeMachineryTab(subTab);
    if (urlTab !== current && typeof setSubTab === 'function') {
      setSubTab(urlTab);
    }
    // Solo al montar: la pestaña es estado del módulo, no de la URL en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link ?machine=TR-001: abre el drawer de detalle sin salir del módulo.
  useEffect(() => {
    const code = readMachineFromUrl();
    if (!code || machineryHook.machinery.length === 0) return;
    const found =
      machineryHook.machinery.find((m) => m.codigoId === code || m.id === code) || null;
    if (found) {
      machineryHook.setSelectedMachine(found);
      machineryHook.setIsDetailModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineryHook.machinery.length]);

  // Adaptador legacy: páginas antiguas llaman setSubTab('operaciones' /
  // 'mantenimientos'). Se normaliza para no romper navegación interna.
  const legacySetSubTab = useCallback(
    (next) => changeTab(normalizeMachineryTab(next)),
    [changeTab],
  );

  const alertCount = useMemo(() => {
    const alerts = maintenanceHook.alerts;
    if (!alerts) return 0;
    return (
      (alerts.critical?.length || 0) +
      (alerts.warning?.length || 0) +
      (alerts.outOfService?.length || 0)
    );
  }, [maintenanceHook.alerts]);

  return (
    <div className="machinery-module">
      <MachineryHeader
        canCreate={canCreateMachine()}
        onRegister={() => machineryHook.setIsAddMachineOpen(true)}
        onGoMaintenance={() => changeTab('mantenimiento')}
        onGoReports={() => changeTab('reportes')}
      />

      <MachineryTabs activeTab={activeTab} onChange={changeTab} alertCount={alertCount} />

      <div key={activeTab} role="tabpanel" className="machinery-tabpanel">
        {activeTab === 'flota' && (
          <FlotaPage
            machineryHook={machineryHook}
            operationHook={operationHook}
            maintenanceHook={maintenanceHook}
            setSubTab={legacySetSubTab}
          />
        )}
        {activeTab === 'jornadas' && (
          <OperacionesPage machineryHook={machineryHook} operationHook={operationHook} />
        )}
        {activeTab === 'mantenimiento' && (
          <MantenimientosPage machineryHook={machineryHook} maintenanceHook={maintenanceHook} />
        )}
        {activeTab === 'combustible' && <CombustiblePage machineryHook={machineryHook} />}
        {activeTab === 'historial' && (
          <HistorialPage machineryHook={machineryHook} operationHook={operationHook} />
        )}
        {activeTab === 'costos' && (
          <CostosPage machineryHook={machineryHook} operationHook={operationHook} />
        )}
        {activeTab === 'alertas' && (
          <AlertasPage machineryHook={machineryHook} maintenanceHook={maintenanceHook} />
        )}
        {activeTab === 'reportes' && <ReportesPage machineryHook={machineryHook} />}
      </div>
    </div>
  );
}

/**
 * MachineryModule — aplicación interna de Maquinaria.
 * El sidebar solo muestra "Maquinaria"; la navegación por pestañas vive aquí
 * y todas las vistas comparten el mismo MachineryProvider (empresa activa,
 * permisos, selección, filtros, caché, eventos).
 */
export default function MachineryModule(props) {
  return (
    <MachineryProvider>
      <MaquinariaShell {...props} />
    </MachineryProvider>
  );
}

export { MachineryModule };
