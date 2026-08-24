/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { WeatherRepository } from '../repository/WeatherRepository';
import { WeatherInterpreter } from '../interpreter/WeatherInterpreter';
import { useCompanyContext } from '../../../context/CompanyContext';

const ClimateContext = createContext(null);

export const ClimateProvider = ({ children }) => {
  const { companyId } = useCompanyContext();
  const [lotes, setLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('temperatura'); // 'temperatura', 'precipitaciÃ³n', 'humedad', 'viento'

  // Cargar lotes al inicio o cuando cambie la empresa activa
  useEffect(() => {
    const loadLotes = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('lotes')
          .select('id, codigo_interno, nombre, cultivo, centroide_lat, centroide_lng, area_ha');
        
        if (dbError) throw dbError;

        if (data && data.length > 0) {
          const mapped = data.map(l => ({
            ...l,
            centroide_lat: l.centroide_lat != null ? parseFloat(l.centroide_lat) : null,
            centroide_lng: l.centroide_lng != null ? parseFloat(l.centroide_lng) : null
          }));
          setLotes(mapped);
          setSelectedLote(mapped[0]);
        } else {
          setLotes([]);
          setSelectedLote(null);
        }
      } catch (err) {
        console.warn('[ClimateContext] Error consultando lotes:', err.message);
        setError('No fue posible cargar los lotes.');
        setLotes([]);
        setSelectedLote(null);
      }
    };

    loadLotes();
  }, [companyId]);

  // Consultar clima para el lote activo
  const fetchWeatherForLote = useCallback(async (lote, forceRefresh = false) => {
    if (!lote) return;
    
    setLoading(true);
    setError(null);

    const lat = lote.centroide_lat;
    const lon = lote.centroide_lng;

    try {
      // 1. Obtener datos crudos desde el Repositorio
      const rawWeather = await WeatherRepository.getWeather(lat, lon, forceRefresh);
      
      // 2. Interpretar reglas agronÃ³micas
      const interpretedWeather = WeatherInterpreter.interpret(rawWeather);
      
      setWeatherData(interpretedWeather);
    } catch (err) {
      console.error('[ClimateContext] Error loading weather:', err.message);
      setError(err.message || 'No se pudo cargar el clima para este lote.');
      setWeatherData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recargar al cambiar de lote
  useEffect(() => {
    if (selectedLote) {
      const timer = setTimeout(() => {
        fetchWeatherForLote(selectedLote);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedLote, fetchWeatherForLote]);

  const forceRefreshActiveLote = useCallback(() => {
    if (selectedLote) {
      // Invalida la cachÃ© primero
      WeatherRepository.invalidateCache(selectedLote.centroide_lat, selectedLote.centroide_lng);
      fetchWeatherForLote(selectedLote, true);
    }
  }, [selectedLote, fetchWeatherForLote]);

  const value = {
    lotes,
    selectedLote,
    setSelectedLote,
    weatherData,
    loading,
    error,
    activeTab,
    setActiveTab,
    refreshWeather: forceRefreshActiveLote
  };

  return (
    <ClimateContext.Provider value={value}>
      {children}
    </ClimateContext.Provider>
  );
};

export const useClimateContext = () => {
  const context = useContext(ClimateContext);
  if (!context) {
    throw new Error('useClimateContext must be used within a ClimateProvider');
  }
  return context;
};
