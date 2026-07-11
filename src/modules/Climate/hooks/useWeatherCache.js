import { useState, useEffect } from 'react';
import { useClimateContext } from '../context/ClimateContext';
import { getCoordinateHash } from '../utils/climateUtils';

const LOCAL_CACHE_KEY_PREFIX = 'skycrop_weather_';

export default function useWeatherCache() {
  const { selectedLote, refreshWeather } = useClimateContext();
  const [cacheStatus, setCacheStatus] = useState({
    cached: false,
    expiresAt: null,
    timeRemaining: 0
  });

  useEffect(() => {
    if (!selectedLote) return;

    const checkCache = () => {
      const hash = getCoordinateHash(selectedLote.centroide_lat, selectedLote.centroide_lng);
      const key = `${LOCAL_CACHE_KEY_PREFIX}${hash}`;
      const saved = localStorage.getItem(key);

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const now = Date.now();
          const remains = Math.max(0, Math.round((parsed.expires_at - now) / 1000));
          
          setCacheStatus({
            cached: remains > 0,
            expiresAt: new Date(parsed.expires_at),
            timeRemaining: remains
          });
        } catch {
          // JSON roto
        }
      } else {
        setCacheStatus({ cached: false, expiresAt: null, timeRemaining: 0 });
      }
    };

    checkCache();
    const interval = setInterval(checkCache, 5000); // Chequear cada 5 segundos
    return () => clearInterval(interval);
  }, [selectedLote]);

  return {
    ...cacheStatus,
    invalidate: () => {
      if (selectedLote) {
        refreshWeather();
      }
    }
  };
}
