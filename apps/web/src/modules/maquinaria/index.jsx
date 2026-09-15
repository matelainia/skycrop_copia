import MachineryModule from './MachineryModule';
import { normalizeMachineryTab } from './constants/machineryTabs';

// Wrapper de compatibilidad: App.jsx pasa subTab/setSubTab con ids
// legacy ('operaciones', 'mantenimientos'). Se normalizan al contrato
// canónico de pestañas (flota, jornadas, mantenimiento, ...).
export default function MaquinariaModuleWrapper({ subTab = 'flota', setSubTab }) {
  const normalizedSetSubTab = (next) => {
    if (typeof setSubTab === 'function') setSubTab(normalizeMachineryTab(next));
  };
  return <MachineryModule subTab={normalizeMachineryTab(subTab)} setSubTab={normalizedSetSubTab} />;
}
export { MaquinariaModuleWrapper as Maquinaria };
