import { useState, useEffect } from 'react';
import { geeRepository } from '../repositories/geeRepository';

export const useGoogleEarthEngine = (selectedLote) => {
  const [geeLoading, setGeeLoading] = useState(false);
  const [geeWarning, setGeeWarning] = useState(null);
  const [geeError, setGeeError] = useState(null);
  const [histogramIndex, setHistogramIndex] = useState('NDVI');
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [geeData, setGeeData] = useState({
    stats: null,
    distribution: null,
    histogram: null,
    index: 'NDVI',
    tileUrl: null
  });

  useEffect(() => {
    if (!selectedLote || !selectedLote.coordinates) return;

    setGeeLoading(true);
    setGeeWarning(null);
    setGeeError(null);

    const indexType = histogramIndex.toUpperCase();

    geeRepository.getGeeIndex(selectedLote.coordinates, indexType, selectedLote.id)
      .then(data => {
        setGeeLoading(false);
        if (data.success) {
          setGeeData({
            stats: data.stats || null,
            distribution: data.distribution || null,
            histogram: data.histogram || null,
            index: indexType,
            tileUrl: data.tileUrl || null
          });
        } else {
          console.warn('[GEE Hook] Error del backend:', data.message);
          if (data.warning) setGeeWarning(data.warning);
          setGeeError(data.message || 'No se pudieron obtener datos del índice desde el servidor.');
          setGeeData({
            stats: null,
            distribution: null,
            histogram: null,
            index: indexType,
            tileUrl: null
          });
        }
      })
      .catch(err => {
        console.warn('[GEE Hook] Error HTTP:', err.message);
        setGeeLoading(false);
        setGeeError(err.message || 'Error de red al consultar Google Earth Engine.');
        setGeeData({
          stats: null,
          distribution: null,
          histogram: null,
          index: indexType,
          tileUrl: null
        });
      });
  }, [selectedLote?.id, histogramIndex]);

  return {
    geeLoading,
    geeWarning,
    geeError,
    geeData,
    histogramIndex,
    isEvolutionModalOpen,
    hoveredBar,
    setHistogramIndex,
    setIsEvolutionModalOpen,
    setHoveredBar,
    setGeeData
  };
};
