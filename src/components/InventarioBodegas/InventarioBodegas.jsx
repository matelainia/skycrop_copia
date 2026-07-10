import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Layers, AlertTriangle, Trash2, Edit3, X, ArrowUpRight, ArrowDownRight, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// Helper to determine item icons based on name/category
const getItemIcon = (category, name) => {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes('urea') || n.includes('fertiliz')) return '🌾';
  if (n.includes('glypho') || n.includes('herbici') || n.includes('pestici') || n.includes('fungici')) return '🧴';
  if (n.includes('maize') || n.includes('seed') || n.includes('semill')) return '🌽';
  if (n.includes('oil') || n.includes('aceite') || n.includes('grasa') || n.includes('diesel')) return '🛢️';
  if (n.includes('glove') || n.includes('guante') || n.includes('helmet') || n.includes('boot') || n.includes('goggle') || c.includes('seguridad')) return '🧤';
  if (n.includes('spade') || n.includes('fork') || n.includes('tool') || n.includes('herram') || n.includes('shear')) return '🛠️';

  if (c.includes('semill')) return '🌱';
  if (c.includes('fertiliz')) return '📦';
  if (c.includes('plaguicid') || c.includes('pestici') || c.includes('herbici')) return '🧪';
  if (c.includes('herramient')) return '🔧';
  if (c.includes('seguridad')) return '🦺';
  if (c.includes('equipo')) return '⚙️';
  return '📦';
};

export default function InventarioBodegas() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [workers, setWorkers] = useState([]);

  // Filter & pagination states
  const [activeWarehouse, setActiveWarehouse] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Drawer / Modal control states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isManageWarehousesOpen, setIsManageWarehousesOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'sub'

  // Form states for items
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Semillas',
    quantity: '',
    unit: 'kg',
    minQuantity: '',
    warehouseId: '',
    lote: '',
    registroIca: '',
    comentarios: ''
  });

  // Form states for warehouses
  const [newWarehouse, setNewWarehouse] = useState({
    nombre: '',
    sector: '',
    coordenadaX: '',
    coordenadaY: '',
    categoria: 'Agroquímicos',
    categoriaOtro: '',
    responsableId: ''
  });

  // Fetch inventory from Supabase
  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minQuantity: item.min_quantity,
        warehouseId: item.warehouse_id,
        lote: item.lote,
        registroIca: item.registro_ica,
        comentarios: item.comentarios
      }));
      setItems(mapped);
      return mapped;
    } catch (err) {
      console.error("Error al cargar inventario:", err.message);
      return [];
    }
  };

  // Fetch warehouses from Supabase
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('bodegas')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setWarehouses(data || []);
      return data || [];
    } catch (err) {
      console.error("Error al cargar bodegas:", err.message);
      return [];
    }
  };

  // Fetch workers from Supabase (to list as managers)
  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('trabajadores')
        .select('id, nombres, apellidos')
        .order('nombres', { ascending: true });
      if (error) throw error;
      setWorkers(data || []);
      return data || [];
    } catch (err) {
      console.error("Error al cargar trabajadores:", err.message);
      return [];
    }
  };

  // Auto seed database if empty
  const seedDatabaseIfEmpty = async (fetchedWarehouses, fetchedWorkers) => {
    let currentWarehouses = [...fetchedWarehouses];

    // 1. Seed warehouses if none exist
    if (fetchedWarehouses.length === 0) {
      const defaultBodegas = [
        { nombre: 'Bodega Central', sector: 'Sector A (Semillas y Abonos)', coordenada_x: 3.4516, coordenada_y: -76.5320, categoria: 'Fertilizantes', responsable_id: fetchedWorkers[0]?.id || null },
        { nombre: 'Bodega Norte', sector: 'Sector B (Herramientas)', coordenada_x: 3.4600, coordenada_y: -76.5400, categoria: 'Herramientas', responsable_id: fetchedWorkers[1]?.id || null },
        { nombre: 'Bodega Sur', sector: 'Sector C (Químicos y Plaguicidas)', coordenada_x: 3.4400, coordenada_y: -76.5200, categoria: 'Agroquímicos', responsable_id: fetchedWorkers[2]?.id || null }
      ];
      try {
        const { data, error } = await supabase.from('bodegas').insert(defaultBodegas).select();
        if (error) throw error;
        if (data) {
          currentWarehouses = data;
          setWarehouses(data);
        }
      } catch (err) {
        console.error("Error al auto-sembrar bodegas:", err.message);
      }
    }

    // 2. Seed items if none exist
    const { data: currentItems, error: itemsError } = await supabase.from('inventario').select('id');
    if (!itemsError && (!currentItems || currentItems.length === 0)) {
      const centralWh = currentWarehouses.find(w => w.nombre.includes('Central'))?.id || null;
      const norteWh = currentWarehouses.find(w => w.nombre.includes('Norte'))?.id || null;
      const surWh = currentWarehouses.find(w => w.nombre.includes('Sur'))?.id || null;

      const seedItems = [
        { name: 'Urea Fertilizing Granules', category: 'Fertilizantes', quantity: 150, unit: 'Sacos', min_quantity: 100, warehouse_id: centralWh, lote: 'L-774', registro_ica: 'ICA-0012', comentarios: 'Fertilizante de alta calidad.' },
        { name: 'Glyphosate Herbicide', category: 'Herbicidas', quantity: 15, unit: 'Latas', min_quantity: 25, warehouse_id: norteWh, lote: 'L-893', registro_ica: 'ICA-3921', comentarios: 'Control de maleza.' },
        { name: 'Maize P1 Seed', category: 'Semillas', quantity: 30, unit: 'Sacos', min_quantity: 20, warehouse_id: centralWh, lote: 'L-211', registro_ica: 'ICA-1945', comentarios: 'Semilla híbrida certificada.' },
        { name: 'Tractor Oil 10W40', category: 'Mantenimiento', quantity: 5, unit: 'Gals', min_quantity: 10, warehouse_id: norteWh, lote: 'L-104', registro_ica: 'ICA-9941', comentarios: 'Lubricante para motores diesel.' },
        { name: 'Pesticide Delta', category: 'Pesticidas', quantity: 10, unit: 'Latas', min_quantity: 15, warehouse_id: surWh, lote: 'L-673', registro_ica: 'ICA-4819', comentarios: 'Insecticida potente.' },
        { name: 'Safety Gloves', category: 'Seguridad', quantity: 50, unit: 'Pairs', min_quantity: 30, warehouse_id: surWh, lote: 'L-029', registro_ica: 'ICA-N/A', comentarios: 'Protección para fumigadores.' },
        { name: 'Spade and Fork Set', category: 'Herramientas', quantity: 8, unit: 'Units', min_quantity: 5, warehouse_id: norteWh, lote: 'L-001', registro_ica: 'ICA-N/A', comentarios: 'Herramientas de mano de acero.' }
      ];

      const categories = ['Semillas', 'Fertilizantes', 'Herbicidas', 'Pesticidas', 'Mantenimiento', 'Seguridad', 'Herramientas'];
      const units = ['Sacos', 'Latas', 'Gals', 'Pairs', 'Units', 'kg', 'L'];
      const names = [
        'Urea Fertilizing Granules', 'Glyphosate Herbicide', 'Maize P1 Seed', 'Tractor Oil 10W40',
        'Pesticide Delta', 'Safety Gloves', 'Spade and Fork Set', 'Potassium Fertilizer',
        'Tomato Seeds F1', 'Nylon Rope Roll', 'Sprayer Nozzles', 'Irrigation Drip Tape',
        'Pruning Shears', 'Diesel Fuel Additive', 'Protective Goggles', 'Organic Compost Bag',
        'Soybean Seeds', 'Herbicida Rápido', 'Fungicida Premium', 'Shovel Wood Handle',
        'Wheelbarrow Metal', 'Gardening Rake', 'PVC pipe 2 inch', 'Work Boots Leather',
        'Reflective Vest', 'Tractor Air Filter', 'Grease Tube', 'Water Pump Belt',
        'Insecticide Spray', 'Copper Fungicide', 'Wheat Seeds winter', 'Calcium Nitrate Bag',
        'PH Meter Digital', 'Soil Soil Probe', 'Nitrogen Fertilizer Extra', 'Grass Killer Concentrated',
        'Safety Helmet Yellow', 'Ear Plugs Foam', 'Toolbox Metal Case', 'Chain Saw Oil',
        'Hydraulic Oil Fluid', 'Corn Seeds Yellow'
      ];

      for (let i = 7; i < 42; i++) {
        const name = names[i] || `Insumo Genérico ${i}`;
        const category = categories[i % categories.length];
        const unit = units[i % units.length];
        const quantity = Math.floor(Math.random() * 80) + 10;
        const min_quantity = Math.floor(Math.random() * 30) + 12;
        const whId = i % 3 === 0 ? centralWh : (i % 3 === 1 ? norteWh : surWh);
        seedItems.push({
          name,
          category,
          quantity,
          unit,
          min_quantity,
          warehouse_id: whId,
          lote: `L-${Math.floor(Math.random() * 900) + 100}`,
          registro_ica: `ICA-${Math.floor(Math.random() * 8000) + 1000}`,
          comentarios: 'Registrado en el sembrado inicial.'
        });
      }

      try {
        const { error } = await supabase.from('inventario').insert(seedItems);
        if (error) throw error;
        await fetchInventory();
      } catch (err) {
        console.error("Error al auto-sembrar inventario:", err.message);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      const dbWorkers = await fetchWorkers();
      const dbWarehouses = await fetchWarehouses();
      const dbItems = await fetchInventory();

      if (dbWarehouses.length === 0 || dbItems.length === 0) {
        await seedDatabaseIfEmpty(dbWarehouses, dbWorkers);
      }
    };
    init();
  }, []);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, activeWarehouse]);

  // Set default warehouseId in item form when warehouses load
  useEffect(() => {
    if (warehouses.length > 0 && !newItem.warehouseId) {
      setNewItem(prev => ({ ...prev, warehouseId: warehouses[0].id }));
    }
  }, [warehouses]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim() || newItem.quantity === '' || newItem.minQuantity === '' || !newItem.warehouseId) {
      alert("Por favor completa todos los campos requeridos.");
      return;
    }

    const dbItem = {
      name: newItem.name.trim(),
      category: newItem.category,
      quantity: Number(newItem.quantity),
      unit: newItem.unit,
      min_quantity: Number(newItem.minQuantity),
      warehouse_id: newItem.warehouseId,
      lote: newItem.lote.trim(),
      registro_ica: newItem.registroIca.trim(),
      comentarios: newItem.comentarios.trim()
    };

    try {
      const { data, error } = await supabase.from('inventario').insert([dbItem]).select();
      if (error) throw error;
      if (data && data[0]) {
        const added = {
          id: data[0].id,
          name: data[0].name,
          category: data[0].category,
          quantity: data[0].quantity,
          unit: data[0].unit,
          minQuantity: data[0].min_quantity,
          warehouseId: data[0].warehouse_id,
          lote: data[0].lote,
          registroIca: data[0].registro_ica,
          comentarios: data[0].comentarios
        };
        setItems(prev => [added, ...prev]);
      }
      setNewItem({
        name: '',
        category: 'Semillas',
        quantity: '',
        unit: 'kg',
        minQuantity: '',
        warehouseId: warehouses[0]?.id || '',
        lote: '',
        registroIca: '',
        comentarios: ''
      });
      setIsDrawerOpen(false);
    } catch (err) {
      alert("Error al registrar insumo: " + err.message);
    }
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!newWarehouse.nombre.trim() || !newWarehouse.sector.trim()) return;

    const selectedCategory = newWarehouse.categoria === 'Otro'
      ? newWarehouse.categoriaOtro.trim()
      : newWarehouse.categoria;

    if (!selectedCategory) {
      alert("Por favor especifica la categoría.");
      return;
    }

    const dbWarehouse = {
      nombre: newWarehouse.nombre.trim(),
      sector: newWarehouse.sector.trim(),
      coordenada_x: newWarehouse.coordenadaX !== '' ? Number(newWarehouse.coordenadaX) : null,
      coordenada_y: newWarehouse.coordenadaY !== '' ? Number(newWarehouse.coordenadaY) : null,
      categoria: selectedCategory,
      responsable_id: newWarehouse.responsableId !== '' ? newWarehouse.responsableId : null
    };

    try {
      const { data, error } = await supabase.from('bodegas').insert([dbWarehouse]).select();
      if (error) throw error;

      if (data && data[0]) {
        setWarehouses(prev => [...prev, data[0]]);
      }

      setNewWarehouse({
        nombre: '',
        sector: '',
        coordenadaX: '',
        coordenadaY: '',
        categoria: 'Agroquímicos',
        categoriaOtro: '',
        responsableId: ''
      });
    } catch (err) {
      alert("Error al registrar bodega: " + err.message);
    }
  };

  const handleDeleteWarehouse = async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta bodega? Los artículos asociados no se borrarán, pero quedarán sin bodega asignada.')) return;

    try {
      const { error } = await supabase.from('bodegas').delete().eq('id', id);
      if (error) throw error;

      setWarehouses(prev => prev.filter(w => w.id !== id));

      setItems(prev => prev.map(item => {
        if (item.warehouseId === id) {
          return { ...item, warehouseId: null };
        }
        return item;
      }));

      if (activeWarehouse === id) {
        setActiveWarehouse('all');
      }
    } catch (err) {
      alert("Error al eliminar bodega: " + err.message);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!selectedItem || adjustAmount === '') return;

    const amount = Number(adjustAmount);
    let newQty = selectedItem.quantity;
    if (adjustType === 'add') {
      newQty += amount;
    } else {
      newQty = Math.max(0, newQty - amount);
    }

    try {
      const { error } = await supabase
        .from('inventario')
        .update({ quantity: newQty })
        .eq('id', selectedItem.id);

      if (error) throw error;

      setItems(prev => prev.map(item => {
        if (item.id === selectedItem.id) {
          return { ...item, quantity: newQty };
        }
        return item;
      }));

      setIsAdjustOpen(false);
      setSelectedItem(null);
      setAdjustAmount('');
    } catch (err) {
      alert("Error al ajustar stock: " + err.message);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este artículo del inventario?')) return;

    try {
      const { error } = await supabase.from('inventario').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert("Error al eliminar insumo: " + err.message);
    }
  };

  // Helper helper to format manager name
  const getResponsableName = (id) => {
    const worker = workers.find(w => w.id === id);
    return worker ? `${worker.nombres} ${worker.apellidos}` : 'Sin asignar';
  };

  // Calculations
  const totalItemsCount = items.length;
  const lowStockItems = items.filter(item => item.quantity < item.minQuantity);
  const lowStockCount = lowStockItems.length;

  // Calculate dynamic Bodega Central occupancy
  const centralWh = warehouses.find(w => w.nombre.toLowerCase().includes('central'));
  const centralItems = items.filter(item => item.warehouseId === centralWh?.id);
  const totalCentralQty = centralItems.reduce((acc, item) => acc + item.quantity, 0);
  const occupancyPercentage = Math.min(100, Math.round((totalCentralQty / 500) * 100)) || 0;

  // Build warehouse stats dynamically
  const warehouseStats = [
    { id: 'all', name: 'Todas las Bodegas', location: 'General', count: items.length },
    ...warehouses.map(w => ({
      id: w.id,
      name: w.nombre,
      location: w.sector,
      categoria: w.categoria,
      coordenada_x: w.coordenada_x,
      coordenada_y: w.coordenada_y,
      responsable_id: w.responsable_id,
      count: items.filter(item => item.warehouseId === w.id).length
    }))
  ];

  // Filters
  const filteredItems = items.filter(item => {
    const matchesWarehouse = activeWarehouse === 'all' || item.warehouseId === activeWarehouse;
    const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesWarehouse && matchesCategory && matchesSearch;
  });

  // Pagination calculations
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  return (
    <>
      <div className="section-header">
        <div className="section-title-box">
          <h2>Inventario y Bodegas</h2>
          <p className="section-desc">Control de insumos, herramientas, semillas y agroquímicos por bodega</p>
        </div>
        <div className="section-actions">
          <button className="btn btn-secondary" onClick={() => setIsManageWarehousesOpen(true)}>
            <Layers size={18} />
            <span>Gestionar Bodegas</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsDrawerOpen(true)}>
            <Plus size={18} />
            <span>Agregar Insumo</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="glass-card primary-edge">
          <div className="card-title-section">
            <span className="card-label">Total Insumos</span>
            <div className="card-icon-box green">
              <Package size={18} />
            </div>
          </div>
          <div className="card-value">{totalItemsCount}</div>
          <div className="card-desc">Artículos registrados en catálogo</div>
        </div>

        <div className="glass-card danger-edge">
          <div className="card-title-section">
            <span className="card-label">Bajo Stock Crítico</span>
            <div className="card-icon-box red">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="card-value">{lowStockCount}</div>
          <div className="card-desc">Requieren reabastecimiento urgente</div>
        </div>

        <div className="glass-card info-edge">
          <div className="card-title-section">
            <span className="card-label">Bodegas Monitoreadas</span>
            <div className="card-icon-box blue">
              <Layers size={18} />
            </div>
          </div>
          <div className="card-value">{warehouses.length}</div>
          <div className="card-desc">Espacios físicos diferenciados</div>
        </div>

        <div className="glass-card primary-edge">
          <div className="card-title-section">
            <span className="card-label">Ocupación Bodega Central</span>
            <div className="card-icon-box green">
              <Layers size={18} />
            </div>
          </div>
          <div className="card-value">{occupancyPercentage}%</div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${occupancyPercentage}%` }}></div>
          </div>
        </div>
      </div>

      {/* Warehouse Selection Cells */}
      <div className="warehouse-grid">
        {warehouseStats.map(wh => (
          <div
            key={wh.id}
            className={`warehouse-cell ${activeWarehouse === wh.id ? 'active' : ''}`}
            onClick={() => setActiveWarehouse(wh.id)}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}
          >
            <div>
              <div className="warehouse-cell-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{wh.name}</span>
                {wh.id !== 'all' && (
                  <span style={{ fontSize: '10px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                    {wh.categoria}
                  </span>
                )}
              </div>
              <div className="warehouse-cell-details">{wh.location}</div>

              {wh.id !== 'all' && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {wh.coordenada_x !== null && wh.coordenada_y !== null && (
                    <div>Ubicación: ({wh.coordenada_x}, {wh.coordenada_y})</div>
                  )}
                  <div>Responsable: {getResponsableName(wh.responsable_id)}</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)' }}>
              {wh.count} {wh.count === 1 ? 'artículo' : 'artículos'}
            </div>
          </div>
        ))}
      </div>

      {/* Main Catalog Section */}
      <div className="glass-card">
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar insumos por nombre..."
              className="input-glass"
              style={{ width: '100%', paddingLeft: '40px' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-glass select-glass"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ minWidth: '180px' }}
          >
            <option value="Todos">Todas las Categorías</option>
            <option value="Semillas">Semillas</option>
            <option value="Fertilizantes">Fertilizantes</option>
            <option value="Herbicidas">Herbicidas</option>
            <option value="Pesticidas">Pesticidas</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Seguridad">Seguridad</option>
            <option value="Herramientas">Herramientas</option>
          </select>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Categoría</th>
                <th>Stock Actual</th>
                <th>Bodega Asignada</th>
                <th>Mínimo Requerido</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length > 0 ? (
                paginatedItems.map(item => {
                  const isLow = item.quantity < item.minQuantity;
                  const warehouseObj = warehouses.find(w => w.id === item.warehouseId);

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{getItemIcon(item.category, item.name)}</span>
                          <div>
                            <div>{item.name}</div>
                            {(item.lote || item.registroIca) && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                                {item.lote && `Lote: ${item.lote}`} {item.lote && item.registroIca && ' | '} {item.registroIca && `ICA: ${item.registroIca}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{item.category}</td>
                      <td style={{ fontWeight: '600' }}>
                        {item.quantity} {item.unit}
                      </td>
                      <td>{warehouseObj ? warehouseObj.nombre : 'Sin asignar'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>Min: {item.minQuantity}</td>
                      <td style={{ fontWeight: '600', color: isLow ? '#d97706' : '#16a34a' }}>
                        {isLow ? 'Bajo Stock' : 'Stock Óptimo'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsViewOpen(true);
                            }}
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            title="Ver Detalles"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsAdjustOpen(true);
                            }}
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            title="Ajustar Inventario"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteItem(item.id)}
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No se encontraron artículos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {totalItems > 0 ? (
              `${startIndex + 1}-${endIndex} de ${totalItems} artículos`
            ) : (
              '0-0 de 0 artículos'
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Pág.</span>
            <select
              value={currentPage}
              onChange={e => setCurrentPage(Number(e.target.value))}
              className="input-glass select-glass"
              style={{ padding: '4px 28px 4px 10px', fontSize: '13px', minWidth: '60px', height: '32px' }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
              >
                |&lt;
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
              >
                &lt;
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', height: '32px', fontSize: '12px', cursor: 'default' }}
              >
                {currentPage}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
              >
                &gt;
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
              >
                &gt;|
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Inventory Dialog Modal */}
      {isAdjustOpen && selectedItem && (
        <div className="drawer-backdrop" onClick={() => { setIsAdjustOpen(false); setSelectedItem(null); }}>
          <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Ajustar Inventario</h3>
              <button className="btn btn-secondary" onClick={() => { setIsAdjustOpen(false); setSelectedItem(null); }} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Artículo Seleccionado:</span>
              <h4 style={{ fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{selectedItem.name}</h4>
              <p style={{ fontSize: '14px', marginTop: '6px' }}>Stock actual: <strong style={{ color: 'var(--primary)' }}>{selectedItem.quantity} {selectedItem.unit}</strong></p>
            </div>

            <form onSubmit={handleAdjustStock} className="drawer-form">
              <div>
                <label className="form-label">Tipo de Movimiento</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${adjustType === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setAdjustType('add')}
                    style={{ justifyContent: 'center' }}
                  >
                    <ArrowUpRight size={16} />
                    Entrada / Carga
                  </button>
                  <button
                    type="button"
                    className={`btn ${adjustType === 'sub' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setAdjustType('sub')}
                    style={{ justifyContent: 'center' }}
                  >
                    <ArrowDownRight size={16} />
                    Salida / Despacho
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">Cantidad a modificar ({selectedItem.unit})</label>
                <input
                  type="number"
                  min="1"
                  className="input-glass"
                  style={{ width: '100%' }}
                  placeholder="Ej. 50"
                  required
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => { setIsAdjustOpen(false); setSelectedItem(null); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Item Details Modal */}
      {isViewOpen && selectedItem && (
        <div className="drawer-backdrop" onClick={() => { setIsViewOpen(false); setSelectedItem(null); }}>
          <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Detalles del Insumo</h3>
              <button className="btn btn-secondary" onClick={() => { setIsViewOpen(false); setSelectedItem(null); }} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>{getItemIcon(selectedItem.category, selectedItem.name)}</span>
                <div>
                  <h4 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '700' }}>{selectedItem.name}</h4>
                  <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {selectedItem.category}
                  </span>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Stock Actual:</span>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedItem.quantity} {selectedItem.unit}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Mínimo Requerido:</span>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                    Min: {selectedItem.minQuantity} {selectedItem.unit}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Lote:</span>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedItem.lote || 'Sin especificar'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Registro ICA:</span>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedItem.registroIca || 'Sin especificar'}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Bodega Asignada:</span>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {warehouses.find(w => w.id === selectedItem.warehouseId)?.nombre || 'Sin asignar'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Estado del Inventario:</span>
                <div style={{ marginTop: '6px' }}>
                  <span className={`badge ${selectedItem.quantity < selectedItem.minQuantity ? 'badge-red' : 'badge-green'}`}>
                    {selectedItem.quantity < selectedItem.minQuantity ? 'Bajo Stock' : 'Stock Óptimo'}
                  </span>
                </div>
              </div>

              {selectedItem.comentarios && (
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Comentarios:</span>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                    {selectedItem.comentarios}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '10px' }}>
                <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setIsViewOpen(false); setSelectedItem(null); }}>
                  Cerrar Detalles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Drawer */}
      {isDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Agregar Insumo al Inventario</h3>
              <button className="btn btn-secondary" onClick={() => setIsDrawerOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form className="drawer-form" onSubmit={handleAddItem}>
              <div>
                <label className="form-label">Nombre del Artículo / Insumo</label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ width: '100%' }}
                  placeholder="Ej. Abono Orgánico Bocashi"
                  required
                  value={newItem.name}
                  onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Categoría</label>
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={newItem.category}
                    onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Semillas">Semillas</option>
                    <option value="Fertilizantes">Fertilizantes</option>
                    <option value="Herbicidas">Herbicidas</option>
                    <option value="Pesticidas">Pesticidas</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Seguridad">Seguridad</option>
                    <option value="Herramientas">Herramientas</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Unidad de Medida</label>
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={newItem.unit}
                    onChange={e => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="L">Litros (L)</option>
                    <option value="unidades">Unidades</option>
                    <option value="sacos">Sacos</option>
                  </select>
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. 100"
                    required
                    value={newItem.quantity}
                    onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Mínimo de Alerta (Stock Crítico)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. 20"
                    required
                    value={newItem.minQuantity}
                    onChange={e => setNewItem(prev => ({ ...prev, minQuantity: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Número de Lote</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. LT-1092"
                    value={newItem.lote}
                    onChange={e => setNewItem(prev => ({ ...prev, lote: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Registro ICA</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. ICA-1029-F"
                    value={newItem.registroIca}
                    onChange={e => setNewItem(prev => ({ ...prev, registroIca: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Comentarios</label>
                <textarea
                  className="input-glass"
                  style={{ width: '100%', height: '80px', resize: 'vertical' }}
                  placeholder="Ej. Mantener en un ambiente seco y protegido de la luz solar..."
                  value={newItem.comentarios}
                  onChange={e => setNewItem(prev => ({ ...prev, comentarios: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Bodega de Almacenamiento</label>
                {warehouses.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--accent-red)', padding: '10px', background: 'var(--accent-red-light)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    No hay bodegas registradas. Por favor, agregue una bodega primero usando el botón "Gestionar Bodegas".
                  </div>
                ) : (
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={newItem.warehouseId}
                    onChange={e => setNewItem(prev => ({ ...prev, warehouseId: e.target.value }))}
                    required
                  >
                    <option value="">Seleccione una bodega...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.nombre} ({w.sector})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsDrawerOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={warehouses.length === 0}>
                  Registrar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Warehouses Drawer */}
      {isManageWarehousesOpen && (
        <div className="drawer-backdrop" onClick={() => setIsManageWarehousesOpen(false)}>
          <div className="drawer-content" style={{ width: '550px' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Gestionar Bodegas</h3>
              <button className="btn btn-secondary" onClick={() => setIsManageWarehousesOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* List of Warehouses */}
            <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Bodegas Registradas</h4>
              {warehouses.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay bodegas registradas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {warehouses.map(w => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{w.nombre}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {w.sector} | <span style={{ color: 'var(--primary)' }}>{w.categoria}</span> {w.coordenada_x && w.coordenada_y && ` | (${w.coordenada_x}, ${w.coordenada_y})`}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Responsable: <strong>{getResponsableName(w.responsable_id)}</strong>
                        </div>
                      </div>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteWarehouse(w.id)}
                        style={{ padding: '8px', borderRadius: '8px' }}
                        title="Eliminar Bodega"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Warehouse Form */}
            <div>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Agregar Nueva Bodega</h4>
              <form className="drawer-form" onSubmit={handleCreateWarehouse}>
                <div>
                  <label className="form-label">Nombre de la Bodega</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. Bodega Central"
                    required
                    value={newWarehouse.nombre}
                    onChange={e => setNewWarehouse(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Sector o Área</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. Sector A (Semillas y Abonos)"
                    required
                    value={newWarehouse.sector}
                    onChange={e => setNewWarehouse(prev => ({ ...prev, sector: e.target.value }))}
                  />
                </div>

                <div className="form-group-container">
                  <div>
                    <label className="form-label">Coordenada X (Latitud)</label>
                    <input
                      type="number"
                      step="any"
                      className="input-glass"
                      style={{ width: '100%' }}
                      placeholder="Ej. 3.4516"
                      required
                      value={newWarehouse.coordenadaX}
                      onChange={e => setNewWarehouse(prev => ({ ...prev, coordenadaX: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Coordenada Y (Longitud)</label>
                    <input
                      type="number"
                      step="any"
                      className="input-glass"
                      style={{ width: '100%' }}
                      placeholder="Ej. -76.5320"
                      required
                      value={newWarehouse.coordenadaY}
                      onChange={e => setNewWarehouse(prev => ({ ...prev, coordenadaY: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Categoría</label>
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={newWarehouse.categoria}
                    onChange={e => setNewWarehouse(prev => ({ ...prev, categoria: e.target.value }))}
                  >
                    <option value="Agroquímicos">Agroquímicos</option>
                    <option value="Fertilizantes">Fertilizantes</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {newWarehouse.categoria === 'Otro' && (
                  <div>
                    <label className="form-label">Especificar Categoría</label>
                    <input
                      type="text"
                      className="input-glass"
                      style={{ width: '100%' }}
                      placeholder="Ej. Empaques, Riego, etc."
                      required
                      value={newWarehouse.categoriaOtro}
                      onChange={e => setNewWarehouse(prev => ({ ...prev, categoriaOtro: e.target.value }))}
                    />
                  </div>
                )}

                <div>
                  <label className="form-label">Responsable de la Bodega</label>
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={newWarehouse.responsableId}
                    onChange={e => setNewWarehouse(prev => ({ ...prev, responsableId: e.target.value }))}
                  >
                    <option value="">Sin responsable asignado</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.nombres} {w.apellidos}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsManageWarehousesOpen(false)}>
                    Cerrar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                    Guardar Bodega
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
