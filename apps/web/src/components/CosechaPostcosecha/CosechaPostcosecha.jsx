import React, { useState, useEffect } from 'react';
import { Leaf, Sprout, BarChart3, Thermometer, Droplet, Plus, Trash2, X, Archive, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const INITIAL_HARVESTS = [];

const INITIAL_STORAGES = [
  { id: 'silo-1', name: 'Silo de Granos 1', temp: 18.2, humidity: 45, maxCapacity: 200, currentLoad: 0, unit: 'toneladas' },
  { id: 'silo-2', name: 'Silo de Granos 2', temp: 19.5, humidity: 42, maxCapacity: 200, currentLoad: 0, unit: 'toneladas' },
  { id: 'cold-room', name: 'Cámara Frigorífica 1', temp: 4.5, humidity: 82, maxCapacity: 50, currentLoad: 0, unit: 'toneladas' }
];

const CHART_DATA = [
  { month: 'Ene', value: 0 },
  { month: 'Feb', value: 0 },
  { month: 'Mar', value: 0 },
  { month: 'Abr', value: 0 },
  { month: 'May', value: 0 }
];

export default function CosechaPostcosecha() {
  const [harvests, setHarvests] = useState(INITIAL_HARVESTS);
  const [storages, setStorages] = useState(INITIAL_STORAGES);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // New harvest state
  const [newHarvest, setNewHarvest] = useState({
    lot: 'A1',
    crop: 'Maíz Híbrido',
    weight: '',
    grade: 'Grado A',
    storageId: 'silo-1'
  });

  const fetchHarvestsAndStorages = async () => {
    try {
      // 1. Fetch storages
      const { data: storeData, error: storeError } = await supabase.from('almacenamientos').select('*');
      if (storeError) throw storeError;
      const mappedStorages = (storeData || []).map(s => ({
        id: s.id,
        name: s.name,
        temp: s.temp,
        humidity: s.humidity,
        maxCapacity: s.max_capacity,
        currentLoad: s.current_load,
        unit: s.unit
      }));
      
      // Sort storages to maintain order Silo 1, Silo 2, Cámara Frigorífica
      mappedStorages.sort((a, b) => a.name.localeCompare(b.name));
      setStorages(mappedStorages);
      
      if (mappedStorages.length > 0) {
        setNewHarvest(prev => ({
          ...prev,
          storageId: mappedStorages[0].id // Set to the first real UUID
        }));
      }

      // 2. Fetch harvests
      const { data: harvestData, error: harvestError } = await supabase.from('cosechas').select('*').order('created_at', { ascending: false });
      if (harvestError) throw harvestError;
      const mappedHarvests = (harvestData || []).map(h => ({
        id: h.id,
        lot: h.lote,
        crop: h.crop,
        weight: h.weight,
        grade: h.grade,
        storage: h.storage,
        date: h.date
      }));
      setHarvests(mappedHarvests);

    } catch (err) {
      console.error("Error al cargar cosechas/silos:", err.message);
    }
  };

  useEffect(() => {
    fetchHarvestsAndStorages();
  }, []);

  const handleAddHarvest = async (e) => {
    e.preventDefault();
    if (!newHarvest.weight || Number(newHarvest.weight) <= 0) return;

    const selectedStorageObj = storages.find(s => s.id === newHarvest.storageId);
    const weightNum = Number(newHarvest.weight);

    const dbHarvest = {
      lote: newHarvest.lot,
      crop: newHarvest.crop,
      weight: weightNum,
      grade: newHarvest.grade,
      storage: selectedStorageObj ? selectedStorageObj.name : 'Almacén general'
    };

    try {
      // 1. Insert harvest record
      const { data: harvestResult, error: harvestErr } = await supabase.from('cosechas').insert([dbHarvest]).select();
      if (harvestErr) throw harvestErr;

      // 2. Update storage current load in db
      if (selectedStorageObj) {
        const newLoad = Math.min(selectedStorageObj.maxCapacity, selectedStorageObj.currentLoad + weightNum);
        const { error: storeErr } = await supabase
          .from('almacenamientos')
          .update({ current_load: newLoad })
          .eq('id', selectedStorageObj.id);
        if (storeErr) throw storeErr;

        setStorages(prev => prev.map(s => {
          if (s.id === selectedStorageObj.id) {
            return { ...s, currentLoad: newLoad };
          }
          return s;
        }));
      }

      if (harvestResult && harvestResult[0]) {
        const h = harvestResult[0];
        const added = {
          id: h.id,
          lot: h.lote,
          crop: h.crop,
          weight: h.weight,
          grade: h.grade,
          storage: h.storage,
          date: h.date
        };
        setHarvests(prev => [added, ...prev]);
      }

      setNewHarvest(prev => ({
        lot: 'A1',
        crop: 'Maíz Híbrido',
        weight: '',
        grade: 'Grado A',
        storageId: storages.length > 0 ? storages[0].id : ''
      }));
      setIsDrawerOpen(false);
    } catch (err) {
      alert("Error al registrar cosecha: " + err.message);
    }
  };

  const handleDeleteHarvest = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este registro de cosecha?')) return;
    
    const target = harvests.find(h => h.id === id);
    if (!target) return;

    try {
      // 1. Delete harvest record
      const { error: harvestErr } = await supabase.from('cosechas').delete().eq('id', id);
      if (harvestErr) throw harvestErr;

      // 2. Subtract load from storage
      const storageObj = storages.find(s => s.name === target.storage);
      if (storageObj) {
        const newLoad = Math.max(0, storageObj.currentLoad - target.weight);
        const { error: storeErr } = await supabase
          .from('almacenamientos')
          .update({ current_load: newLoad })
          .eq('id', storageObj.id);
        if (storeErr) throw storeErr;

        setStorages(prev => prev.map(s => {
          if (s.id === storageObj.id) {
            return { ...s, currentLoad: newLoad };
          }
          return s;
        }));
      }

      setHarvests(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      alert("Error al eliminar cosecha: " + err.message);
    }
  };

  // Calculations
  const totalWeight = harvests.reduce((acc, curr) => acc + curr.weight, 0);
  const gradeAPct = totalWeight > 0 
    ? Math.round((harvests.filter(h => h.grade === 'Grado A').reduce((acc, curr) => acc + curr.weight, 0) / totalWeight) * 100)
    : 0;

  // Find max yield in monthly data to scale chart bars
  const maxChartValue = Math.max(...CHART_DATA.map(d => d.value), totalWeight);

  // Storage temp averages
  const avgTemp = storages.length > 0
    ? (storages.reduce((acc, curr) => acc + curr.temp, 0) / storages.length).toFixed(1)
    : 0;

  return (
    <>
      <div className="section-header">
        <div className="section-title-box">
          <h2>Cosecha y Postcosecha</h2>
          <p className="section-desc">Reportes de producción, control de calidad y sensores de temperatura en silos</p>
        </div>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setIsDrawerOpen(true)}>
            <Plus size={18} />
            <span>Registrar Cosecha</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-card primary-edge">
          <div className="card-title-section">
            <span className="card-label">Producción Total</span>
            <div className="card-icon-box green">
              <Sprout size={18} />
            </div>
          </div>
          <div className="card-value">{totalWeight.toFixed(1)} T</div>
          <div className="card-desc">Toneladas acumuladas esta temporada</div>
        </div>

        <div className="glass-card info-edge">
          <div className="card-title-section">
            <span className="card-label">Calidad de Cosecha</span>
            <div className="card-icon-box blue">
              <Leaf size={18} />
            </div>
          </div>
          <div className="card-value">{gradeAPct}%</div>
          <div className="card-desc">Producción certificada Grado A</div>
        </div>

        <div className="glass-card primary-edge">
          <div className="card-title-section">
            <span className="card-label">Silos Activos</span>
            <div className="card-icon-box green">
              <Archive size={18} />
            </div>
          </div>
          <div className="card-value">{storages.length}</div>
          <div className="card-desc">Cámaras y bodegas monitoreadas</div>
        </div>

        <div className="glass-card warning-edge">
          <div className="card-title-section">
            <span className="card-label">Temperatura Silos</span>
            <div className="card-icon-box yellow">
              <Thermometer size={18} />
            </div>
          </div>
          <div className="card-value">{avgTemp} °C</div>
          <div className="card-desc">Promedio en silos térmicos</div>
        </div>
      </div>

      {/* Yield Graph & Silo Status Monitors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'stretch' }} className="metrics-grid">
        
        {/* CSS Chart Bar Widget */}
        <div className="glass-card">
          <div className="card-title-section">
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Producción Histórica (Tons/Mes)</h3>
            <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
          </div>
          
          <div className="graph-bars-container">
            {CHART_DATA.map((d, index) => {
              // Scale graph bars according to max production
              const val = index === CHART_DATA.length - 1 ? totalWeight : d.value;
              const heightPct = Math.max(10, Math.min(100, Math.round((val / maxChartValue) * 120)));
              
              return (
                <div key={d.month} className="graph-bar-wrapper">
                  <div 
                    className={`graph-bar ${index === CHART_DATA.length - 1 ? 'blue' : ''}`} 
                    style={{ height: `${heightPct}px` }}
                  >
                    <div className="graph-tooltip">{val.toFixed(1)} Tons</div>
                  </div>
                  <span className="graph-label">{d.month}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
            * Mayo incluye producción del lote actual registrada en tiempo real.
          </p>
        </div>

        {/* Silos Monitoring Cards */}
        <div className="glass-card">
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Monitores de Almacenamiento (Postcosecha)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {storages.map(s => {
              const capacityPct = Math.round((s.currentLoad / s.maxCapacity) * 100);
              const isTempAlert = s.id === 'cold-room' ? s.temp > 6.0 : s.temp > 22.0;

              return (
                <div key={s.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{s.name}</strong>
                    {isTempAlert && <span style={{ color: 'var(--accent-red)', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px', fontWeight: 'bold' }}><ShieldAlert size={12} /> Alerta Térmica</span>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isTempAlert ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                      <Thermometer size={14} style={{ color: 'var(--accent-gold)' }} />
                      Temp: {s.temp} °C
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <Droplet size={14} style={{ color: 'var(--accent-blue)' }} />
                      Humedad: {s.humidity}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Capacidad: {s.currentLoad.toFixed(1)} / {s.maxCapacity} T</span>
                    <span>{capacityPct}%</span>
                  </div>
                  <div className="progress-bar-container" style={{ height: '4px' }}>
                    <div 
                      className={`progress-bar-fill ${capacityPct > 85 ? 'danger' : capacityPct > 65 ? 'warning' : ''}`} 
                      style={{ width: `${capacityPct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Harvest Data Table */}
      <div className="glass-card">
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Registro de Lotes Cosechados</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Cultivo</th>
                <th>Peso Cosechado</th>
                <th>Calidad de Grano</th>
                <th>Lugar de Acopio</th>
                <th>Fecha de Cosecha</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {harvests.length > 0 ? (
                harvests.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: '700', color: 'var(--primary)' }}>Sector {h.lot}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{h.crop}</td>
                    <td style={{ fontWeight: '700', fontSize: '15px' }}>{h.weight.toFixed(1)} T</td>
                    <td>
                      <span className={`badge ${h.grade === 'Grado A' ? 'badge-green' : h.grade === 'Grado B' ? 'badge-blue' : 'badge-yellow'}`}>
                        {h.grade}
                      </span>
                    </td>
                    <td>{h.storage}</td>
                    <td>{h.date}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-danger"
                        onClick={() => handleDeleteHarvest(h.id)}
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        title="Eliminar Registro"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No hay cosechas registradas esta temporada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Harvest Drawer */}
      {isDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Registrar Nueva Cosecha</h3>
              <button className="btn btn-secondary" onClick={() => setIsDrawerOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form className="drawer-form" onSubmit={handleAddHarvest}>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Sector / Lote Cosechado</label>
                  <select 
                    className="input-glass select-glass" 
                    style={{ width: '100%' }}
                    value={newHarvest.lot}
                    onChange={e => setNewHarvest(prev => ({ ...prev, lot: e.target.value }))}
                  >
                    <option value="A1">Sector A1</option>
                    <option value="A2">Sector A2</option>
                    <option value="B1">Sector B1</option>
                    <option value="B2">Sector B2</option>
                    <option value="C1">Sector C1</option>
                    <option value="C2">Sector C2</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Variedad / Cultivo</label>
                  <select 
                    className="input-glass select-glass" 
                    style={{ width: '100%' }}
                    value={newHarvest.crop}
                    onChange={e => setNewHarvest(prev => ({ ...prev, crop: e.target.value }))}
                  >
                    <option value="Maíz Híbrido">Maíz Híbrido</option>
                    <option value="Soya Orgánica">Soya Orgánica</option>
                    <option value="Girasol">Girasol</option>
                  </select>
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Peso Total (Toneladas)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0.1"
                    className="input-glass" 
                    style={{ width: '100%' }}
                    placeholder="Ej. 12.5"
                    required
                    value={newHarvest.weight}
                    onChange={e => setNewHarvest(prev => ({ ...prev, weight: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Clasificación / Calidad</label>
                  <select 
                    className="input-glass select-glass" 
                    style={{ width: '100%' }}
                    value={newHarvest.grade}
                    onChange={e => setNewHarvest(prev => ({ ...prev, grade: e.target.value }))}
                  >
                    <option value="Grado A">Grado A (Premium)</option>
                    <option value="Grado B">Grado B (Estándar)</option>
                    <option value="Grado C">Grado C (Procesamiento)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Destino de Almacenamiento (Postcosecha)</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }}
                  value={newHarvest.storageId}
                  onChange={e => setNewHarvest(prev => ({ ...prev, storageId: e.target.value }))}
                >
                  {storages.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Capacidad libre: {(s.maxCapacity - s.currentLoad).toFixed(1)} T)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsDrawerOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                  Registrar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
