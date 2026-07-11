import { ClimateProvider } from './context/ClimateContext';
import ClimateDashboard from './components/ClimateDashboard';

export default function ClimateModuleWrapper() {
  return (
    <ClimateProvider>
      <ClimateDashboard />
    </ClimateProvider>
  );
}

export { ClimateModuleWrapper as Climate };
