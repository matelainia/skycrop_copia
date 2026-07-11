import { useClimateContext } from '../context/ClimateContext';

export default function useForecast() {
  const { weatherData, activeTab, setActiveTab } = useClimateContext();

  return {
    hourly: weatherData ? weatherData.hourly : [],
    daily: weatherData ? weatherData.daily : [],
    activeTab,
    setActiveTab
  };
}
