
import MachineryProvider from './context/MachineryProvider';
import FlotaPage from './pages/FlotaPage';
import OperacionesPage from './pages/OperacionesPage';
import MantenimientosPage from './pages/MantenimientosPage';
import CombustiblePage from './pages/CombustiblePage';
import HistorialPage from './pages/HistorialPage';
import CostosPage from './pages/CostosPage';
import AlertasPage from './pages/AlertasPage';
import ReportesPage from './pages/ReportesPage';
import useMachinery from './hooks/useMachinery';
import useCurrentOperation from './hooks/useCurrentOperation';
import useMaintenance from './hooks/useMaintenance';

function MaquinariaContent({ subTab = 'flota', setSubTab }) {
  // Initialize Hooks inside context scope
  const machineryHook = useMachinery();
  const operationHook = useCurrentOperation();
  const maintenanceHook = useMaintenance();

  const activeSubView = subTab && [
    'flota', 'operaciones', 'mantenimientos', 'combustible',
    'historial', 'costos', 'alertas', 'reportes'
  ].includes(subTab) ? subTab : 'flota';

  return (
    <>
      {activeSubView === 'flota' && (
        <FlotaPage
          machineryHook={machineryHook}
          operationHook={operationHook}
          maintenanceHook={maintenanceHook}
          setSubTab={setSubTab}
        />
      )}
      {activeSubView === 'operaciones' && (
        <OperacionesPage
          machineryHook={machineryHook}
          operationHook={operationHook}
        />
      )}
      {activeSubView === 'mantenimientos' && (
        <MantenimientosPage
          machineryHook={machineryHook}
          maintenanceHook={maintenanceHook}
        />
      )}
      {activeSubView === 'combustible' && (
        <CombustiblePage
          machineryHook={machineryHook}
        />
      )}
      {activeSubView === 'historial' && (
        <HistorialPage
          machineryHook={machineryHook}
          operationHook={operationHook}
        />
      )}
      {activeSubView === 'costos' && (
        <CostosPage
          machineryHook={machineryHook}
        />
      )}
      {activeSubView === 'alertas' && (
        <AlertasPage
          machineryHook={machineryHook}
          maintenanceHook={maintenanceHook}
        />
      )}
      {activeSubView === 'reportes' && (
        <ReportesPage />
      )}
    </>
  );
}

export default function MaquinariaModuleWrapper(props) {
  return (
    <MachineryProvider>
      <MaquinariaContent {...props} />
    </MachineryProvider>
  );
}
export { MaquinariaModuleWrapper as Maquinaria };
