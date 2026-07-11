import { useState, useEffect } from 'react';
import { geeRepository } from '../repositories/geeRepository';
import { generateMockHistogramAndStats } from '../utils/mock.utils';

export const useGoogleEarthEngine = (selectedLote) => {
  const [geeLoading, setGeeLoading] = useState(false);
  const [geeWarning, setGeeWarning] = useState(null);
  const [histogramIndex, setHistogramIndex] = useState('NDVI');
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [geeData, setGeeData] = useState({
    stats: null,
    distribution: null,
    histogram: null,
    index: 'NDVI'
  });

  useEffect(() => {
    if (!selectedLote || !selectedLote.coordinates) return;

    setGeeLoading(true);
    setGeeWarning(null);

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
          console.warn('[GEE Hook] Backend error, generating mock index data:', data.message);
          const mock = generateMockHistogramAndStats(indexType, selectedLote.centroide_lat + selectedLote.centroide_lng, selectedLote.ndvi_actual);
          setGeeData({
            stats: mock.stats,
            distribution: mock.distribution,
            histogram: mock.histogram,
            index: indexType,
            tileUrl: null
          });
          if (data.warning) setGeeWarning(data.warning);
        }
      })
      .catch(err => {
        console.warn('[GEE Hook] HTTP Fetch error, generating mock index data:', err.message);
        setGeeLoading(false);
        const mock = generateMockHistogramAndStats(indexType, selectedLote.centroide_lat + selectedLote.centroide_lng, selectedLote.ndvi_actual);
        setGeeData({
          stats: mock.stats,
          distribution: mock.distribution,
          histogram: mock.histogram,
          index: indexType,
          tileUrl: null
        });
      });
  }, [selectedLote?.id, histogramIndex]);

  return {
    geeLoading,
    geeWarning,
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
