import { useClimateContext } from '../context/ClimateContext';

export default function useClimate() {
  const { weatherData, loading, error, selectedLote, refreshWeather } = useClimateContext();

  return {
    current: weatherData ? weatherData.current : null,
    interpretations: weatherData ? weatherData.interpretations : null,
    metadata: weatherData ? weatherData.metadata : null,
    alerts: weatherData ? weatherData.alerts : [],
    loading,
    error,
    selectedLote,
    refreshWeather
  };
}
