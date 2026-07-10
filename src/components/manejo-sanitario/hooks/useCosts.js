import { useState, useEffect } from 'react';
import { createCost } from '../types/Cost';
import { costRepository } from '../repositories/costRepository';

export const useCosts = () => {
  const [costos, setCostos] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_costos_cc');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCostoDrawerOpen, setIsCostoDrawerOpen] = useState(false);

  const [newCosto, setNewCosto] = useState({
    lote_id: '',
    categoria: 'Aplicaciones',
    costo: '',
    descripcion: '',
    responsable: ''
  });

  // LocalStorage sync
  useEffect(() => {
    localStorage.setItem('skycrop_costos_cc', JSON.stringify(costos));
  }, [costos]);

  const loadCostsForLote = async (loteId) => {
    if (!loteId) return;
    try {
      const dbCosts = await costRepository.getByLote(loteId);
      if (dbCosts && dbCosts.length > 0) {
        setCostos(prev => {
          const ids = new Set(prev.map(c => String(c.id)));
          const novos = dbCosts.filter(c => !ids.has(String(c.id))).map(c => createCost(c));
          return novos.length ? [...novos, ...prev] : prev;
        });
      }
    } catch (err) {
      console.warn('[Costs Hook] Error loading costs:', err.message);
    }
  };

  const handleAddCosto = (lotes, onAuditLogged) => {
    if (!newCosto.costo) return { success: false, errors: ['El costo es obligatorio.'] };

    const item = createCost({
      id: `cos-${Date.now()}`,
      lote_id: newCosto.lote_id,
      categoria: newCosto.categoria,
      fecha: new Date().toISOString().split('T')[0],
      descripcion: newCosto.descripcion,
      costo: parseFloat(newCosto.costo),
      responsable: newCosto.responsable
    });

    setCostos(prev => [item, ...prev]);
    setIsCostoDrawerOpen(false);

    const targetL = lotes.find(l => l.id === item.lote_id);
    if (onAuditLogged) {
      onAuditLogged(targetL?.codigo_interno || "N/A", `Costo registrado: $${item.costo.toLocaleString()} (${item.categoria})`);
    }

    return { success: true, item };
  };

  return {
    costos,
    isCostoDrawerOpen,
    newCosto,
    setCostos,
    setIsCostoDrawerOpen,
    setNewCosto,
    loadCostsForLote,
    handleAddCosto
  };
};
