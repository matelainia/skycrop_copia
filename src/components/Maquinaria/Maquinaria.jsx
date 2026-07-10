import { useState, useEffect } from 'react';
import {
  Tractor,
  Settings,
  AlertOctagon,
  Activity,
  ShieldCheck,
  Plus,
  Trash2,
  X,
  Play,
  Eye,
  Pencil,
  Wrench,
  Clock,
  Droplet,
  Info,
  Cpu,
  User,
  AlertTriangle,
  BarChart3,
  Search,
  Truck
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function Maquinaria({ subTab = 'flota', setSubTab }) {
  // Database States
  const [machinery, setMachinery] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Selected machinery for detail or active operation tracking
  const [activeMachineId, setActiveMachineId] = useState(null);

  // Modal / Drawer States
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [isStartLaborOpen, setIsStartLaborOpen] = useState(false);
  const [isEndLaborOpen, setIsEndLaborOpen] = useState(false);
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditMachineOpen, setIsEditMachineOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form States
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [newMachine, setNewMachine] = useState({
    codigoId: '',
    name: '',
    type: 'Tractor',
    status: 'Disponible',
    hoursOfOperation: 0,
    fuelConsumption: '15.5 L/h',
    costOperator: 15.0,
    costFuel: 12.0,
    costMaintenance: 8.0,
    costDepreciation: 5.0,
    nextMaintenanceHours: 250,
    photoUrl: ''
  });

  const [laborForm, setLaborForm] = useState({
    maquinariaId: '',
    operator: '',
    lot: '',
    activity: 'Preparación de suelo',
    startHorometro: 0,
    startFuel: 100, // percentage or Liters
    startTime: new Date().toISOString().substring(0, 16)
  });

  const [endLaborForm, setEndLaborForm] = useState({
    jornadaId: '',
    endTime: new Date().toISOString().substring(0, 16),
    endHorometro: 0,
    endFuel: 80,
    notes: ''
  });

  const [maintForm, setMaintForm] = useState({
    maquinariaId: '',
    date: new Date().toISOString().split('T')[0],
    horometro: 0,
    notes: ''
  });

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Machinery
      const { data: machData, error: machErr } = await supabase
        .from('maquinaria')
        .select('*')
        .order('codigo_id', { ascending: true });
      if (machErr) throw machErr;

      const mappedMach = (machData || []).map(m => ({
        id: m.id,
        codigoId: m.codigo_id,
        name: m.name,
        type: m.type,
        status: m.status,
        operatorName: m.operator_name,
        currentTask: m.current_task,
        currentLot: m.current_lot,
        lastMaintenance: m.last_maintenance,
        nextMaintenance: m.next_maintenance,
        nextMaintenanceHours: m.next_maintenance_hours,
        hoursOfOperation: parseFloat(m.hours_of_operation) || 0,
        hoursToday: parseFloat(m.hours_today) || 0,
        fuelConsumption: m.fuel_consumption,
        costOperator: parseFloat(m.cost_operator) || 0,
        costFuel: parseFloat(m.cost_fuel) || 0,
        costMaintenance: parseFloat(m.cost_maintenance) || 0,
        costDepreciation: parseFloat(m.cost_depreciation) || 0,
        photoUrl: m.photo_url || 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&q=80&w=400'
      }));
      setMachinery(mappedMach);

      // Set active machine default to first operating machine if not set
      if (!activeMachineId && mappedMach.length > 0) {
        const operating = mappedMach.find(m => m.status === 'Operando');
        if (operating) {
          setActiveMachineId(operating.id);
        } else {
          setActiveMachineId(mappedMach[0].id);
        }
      }

      // 2. Fetch Jornadas/Operations
      const { data: jorData, error: jorErr } = await supabase
        .from('jornadas_maquinaria')
        .select('*, maquinaria(*)')
        .order('start_time', { ascending: false });
      if (jorErr) throw jorErr;

      const mappedJor = (jorData || []).map(j => ({
        id: j.id,
        maquinariaId: j.maquinaria_id,
        maquinariaName: j.maquinaria?.name,
        maquinariaCodigo: j.maquinaria?.codigo_id,
        maquinariaPhoto: j.maquinaria?.photo_url,
        maquinariaType: j.maquinaria?.type,
        operator: j.operator,
        lot: j.lot,
        activity: j.activity,
        startTime: j.start_time,
        endTime: j.end_time,
        startHorometro: parseFloat(j.start_horometro) || 0,
        endHorometro: parseFloat(j.end_horometro) || 0,
        startFuel: parseFloat(j.start_fuel) || 0,
        endFuel: parseFloat(j.end_fuel) || 0,
        calculatedHours: parseFloat(j.calculated_hours) || 0,
        calculatedFuelConsumption: parseFloat(j.calculated_fuel_consumption) || 0,
        calculatedCost: parseFloat(j.calculated_cost) || 0,
        notes: j.notes,
        status: j.status
      }));
      setJornadas(mappedJor);

    } catch (err) {
      console.error("Error al cargar datos de flota:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (active) {
        fetchData();
      }
    };
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // Calculations & Metrics
  const totalCount = machinery.length;
  const operatingCount = machinery.filter(m => m.status === 'Operando').length;
  const maintenanceCount = machinery.filter(m => m.status === 'En mantenimiento').length;
  const criticalCount = machinery.filter(m => m.status === 'Fuera de servicio').length;
  const availableCount = machinery.filter(m => m.status === 'Disponible').length;

  const totalHoursWorkedToday = machinery.reduce((sum, m) => sum + m.hoursToday, 0);
  // Estimate fuel burn (Liters) based on operating hours and consumption rate
  const totalFuelConsumedToday = machinery.reduce((sum, m) => {
    if (m.status === 'Operando') {
      const burnRate = parseFloat(m.fuelConsumption) || 15.5;
      return sum + (burnRate * (m.hoursToday || 6));
    }
    return sum;
  }, 0);

  // Active operation details for right sidebar
  const getActiveJornadaForMachine = (machId) => {
    return jornadas.find(j => j.maquinariaId === machId && j.status === 'En Progreso');
  };

  const getActiveMachineDetails = () => {
    return machinery.find(m => m.id === activeMachineId);
  };

  const handleOpenAddDrawer = () => {
    setNewMachine({
      codigoId: '',
      name: '',
      type: 'Tractor',
      status: 'Disponible',
      hoursOfOperation: 0,
      fuelConsumption: '15.5 L/h',
      costOperator: 15.0,
      costFuel: 12.0,
      costMaintenance: 8.0,
      costDepreciation: 5.0,
      nextMaintenanceHours: 250,
      photoUrl: ''
    });
    setIsAddMachineOpen(true);
  };

  const handleOpenEditDrawer = (machine) => {
    setSelectedMachine(machine);
    setIsEditMachineOpen(true);
  };

  const handleImageUpload = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `machinery/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('maquinaria')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('maquinaria')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      if (isEdit) {
        setSelectedMachine(prev => ({ ...prev, photoUrl: publicUrl }));
      } else {
        setNewMachine(prev => ({ ...prev, photoUrl: publicUrl }));
      }
    } catch (error) {
      console.error("Error al subir imagen:", error.message);
      alert("Error al subir imagen. Asegúrate de ejecutar el script SQL para crear el bucket 'maquinaria' en tu consola de Supabase. Detalles: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Actions
  const handleAddMachine = async (e) => {
    e.preventDefault();
    const nextM = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const dbMachine = {
      codigo_id: newMachine.codigoId.toUpperCase().trim(),
      name: newMachine.name.trim(),
      type: newMachine.type,
      status: newMachine.status,
      hours_of_operation: parseFloat(newMachine.hoursOfOperation) || 0,
      fuel_consumption: newMachine.fuelConsumption || '15.5 L/h',
      cost_operator: parseFloat(newMachine.costOperator) || 15.0,
      cost_fuel: parseFloat(newMachine.costFuel) || 12.0,
      cost_maintenance: parseFloat(newMachine.costMaintenance) || 8.0,
      cost_depreciation: parseFloat(newMachine.costDepreciation) || 5.0,
      next_maintenance_hours: parseInt(newMachine.nextMaintenanceHours) || 250,
      photo_url: newMachine.photoUrl || undefined,
      last_maintenance: new Date().toISOString().split('T')[0],
      next_maintenance: nextM
    };

    try {
      const { error } = await supabase.from('maquinaria').insert([dbMachine]);
      if (error) throw error;
      await fetchData();
      setIsAddMachineOpen(false);
      setNewMachine({
        codigoId: '',
        name: '',
        type: 'Tractor',
        status: 'Disponible',
        hoursOfOperation: 0,
        fuelConsumption: '15.5 L/h',
        costOperator: 15.0,
        costFuel: 12.0,
        costMaintenance: 8.0,
        costDepreciation: 5.0,
        nextMaintenanceHours: 250,
        photoUrl: ''
      });
    } catch (err) {
      alert("Error al agregar maquinaria: " + err.message);
    }
  };

  const handleEditMachine = async (e) => {
    e.preventDefault();
    if (!selectedMachine) return;

    const dbMachine = {
      name: selectedMachine.name.trim(),
      type: selectedMachine.type,
      status: selectedMachine.status,
      hours_of_operation: parseFloat(selectedMachine.hoursOfOperation) || 0,
      fuel_consumption: selectedMachine.fuelConsumption || '15.5 L/h',
      cost_operator: parseFloat(selectedMachine.costOperator) || 0,
      cost_fuel: parseFloat(selectedMachine.costFuel) || 0,
      cost_maintenance: parseFloat(selectedMachine.costMaintenance) || 0,
      cost_depreciation: parseFloat(selectedMachine.costDepreciation) || 0,
      next_maintenance_hours: parseInt(selectedMachine.nextMaintenanceHours) || 250,
      photo_url: selectedMachine.photoUrl || undefined
    };

    try {
      const { error } = await supabase
        .from('maquinaria')
        .update(dbMachine)
        .eq('id', selectedMachine.id);

      if (error) throw error;
      await fetchData();
      setIsEditMachineOpen(false);
      setSelectedMachine(null);
    } catch (err) {
      alert("Error al editar maquinaria: " + err.message);
    }
  };

  const handleDeleteMachine = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta máquina del SaaS? Se perderán sus historiales de labores.')) return;
    try {
      const { error } = await supabase.from('maquinaria').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert("Error al eliminar maquinaria: " + err.message);
    }
  };

  const handleStartLabor = async (e) => {
    e.preventDefault();
    const targetMachine = machinery.find(m => m.id === laborForm.maquinariaId);
    if (!targetMachine) return;

    const jorRecord = {
      maquinaria_id: laborForm.maquinariaId,
      operator: laborForm.operator.trim(),
      lot: laborForm.lot.trim(),
      activity: laborForm.activity,
      start_time: new Date(laborForm.startTime).toISOString(),
      start_horometro: parseFloat(laborForm.startHorometro) || targetMachine.hoursOfOperation,
      start_fuel: parseFloat(laborForm.startFuel) || 100.0,
      status: 'En Progreso'
    };

    const machUpdate = {
      status: 'Operando',
      operator_name: laborForm.operator.trim(),
      current_task: laborForm.activity,
      current_lot: laborForm.lot.trim()
    };

    try {
      // 1. Insert Jornada
      const { error: jError } = await supabase.from('jornadas_maquinaria').insert([jorRecord]);
      if (jError) throw jError;

      // 2. Update Machinery Status
      const { error: mError } = await supabase
        .from('maquinaria')
        .update(machUpdate)
        .eq('id', laborForm.maquinariaId);
      if (mError) throw mError;

      await fetchData();
      setIsStartLaborOpen(false);
    } catch (err) {
      alert("Error al iniciar labor: " + err.message);
    }
  };

  const handleEndLabor = async (e) => {
    e.preventDefault();
    const targetJornada = jornadas.find(j => j.id === endLaborForm.jornadaId);
    if (!targetJornada) return;

    const hours = (parseFloat(endLaborForm.endHorometro) || 0) - targetJornada.startHorometro;
    if (hours < 0) {
      alert("El horómetro final no puede ser menor que el inicial.");
      return;
    }

    const fuelUsed = targetJornada.startFuel - (parseFloat(endLaborForm.endFuel) || 0);

    const targetMachine = machinery.find(m => m.id === targetJornada.maquinariaId);
    let calculatedCost = 0;
    if (targetMachine) {
      calculatedCost = hours * (targetMachine.costOperator + targetMachine.costFuel + targetMachine.costMaintenance + targetMachine.costDepreciation);
    }

    const jorUpdate = {
      end_time: new Date(endLaborForm.endTime).toISOString(),
      end_horometro: parseFloat(endLaborForm.endHorometro),
      end_fuel: parseFloat(endLaborForm.endFuel),
      calculated_hours: hours,
      calculated_fuel_consumption: fuelUsed > 0 ? fuelUsed : 0,
      calculated_cost: calculatedCost,
      notes: endLaborForm.notes.trim(),
      status: 'Finalizada'
    };

    const machUpdate = {
      status: 'Disponible',
      operator_name: null,
      current_task: null,
      current_lot: null,
      hours_of_operation: (targetMachine ? targetMachine.hoursOfOperation : 0) + hours,
      hours_today: hours // update today's run
    };

    try {
      // 1. Update Jornada
      const { error: jError } = await supabase
        .from('jornadas_maquinaria')
        .update(jorUpdate)
        .eq('id', endLaborForm.jornadaId);
      if (jError) throw jError;

      // 2. Update Machinery
      const { error: mError } = await supabase
        .from('maquinaria')
        .update(machUpdate)
        .eq('id', targetJornada.maquinariaId);
      if (mError) throw mError;

      await fetchData();
      setIsEndLaborOpen(false);
    } catch (err) {
      alert("Error al finalizar labor: " + err.message);
    }
  };

  const handleRegisterMaintenance = async (e) => {
    e.preventDefault();
    const targetMachine = machinery.find(m => m.id === maintForm.maquinariaId);
    if (!targetMachine) return;

    const nextM = new Date(new Date(maintForm.date).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('maquinaria')
        .update({
          status: 'Disponible',
          last_maintenance: maintForm.date,
          next_maintenance: nextM,
          next_maintenance_hours: (targetMachine.next_maintenance_hours || 250) + 250 // add 250 hour maintenance cycle
        })
        .eq('id', maintForm.maquinariaId);

      if (error) throw error;
      await fetchData();
      setIsMaintModalOpen(false);
    } catch (err) {
      alert("Error al registrar mantenimiento: " + err.message);
    }
  };

  // Helper date/time formatter
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Machine circular icon helper
  const getMachineIcon = (type) => {
    let colorClass;
    let bgClass;

    switch (type) {
      case 'Tractor':
        colorClass = '#15803d';
        bgClass = '#dcfce7';
        break;
      case 'Cosechadora':
        colorClass = '#b91c1c';
        bgClass = '#fee2e2';
        break;
      case 'Sembradora':
        colorClass = '#c2410c';
        bgClass = '#ffedd5';
        break;
      case 'Atomizador':
      case 'Pulverizadora':
        colorClass = '#0369a1';
        bgClass = '#e0f2fe';
        break;
      case 'Dron':
        colorClass = '#0e7490';
        bgClass = '#ecfeff';
        break;
      case 'Riego':
        colorClass = '#4338ca';
        bgClass = '#e0e7ff';
        break;
      default:
        colorClass = '#4b5563';
        bgClass = '#f3f4f6';
        break;
    }

    const renderIcon = () => {
      switch (type) {
        case 'Tractor': return <Tractor size={16} />;
        case 'Cosechadora': return <Settings size={16} />;
        case 'Sembradora': return <Activity size={16} />;
        case 'Atomizador':
        case 'Pulverizadora': return <Droplet size={16} />;
        case 'Dron': return <Cpu size={16} />;
        case 'Riego': return <Wrench size={16} />;
        default: return <Truck size={16} />;
      }
    };

    return (
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: bgClass,
        color: colorClass,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {renderIcon()}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Operando':
        return (
          <span className="badge badge-green" style={{ textTransform: 'none', padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Operando
          </span>
        );
      case 'Disponible':
        return (
          <span className="badge badge-blue" style={{ textTransform: 'none', padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
            Disponible
          </span>
        );
      case 'En mantenimiento':
        return (
          <span className="badge badge-yellow" style={{ textTransform: 'none', padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
            Mantenimiento
          </span>
        );
      case 'Fuera de servicio':
        return (
          <span className="badge badge-red" style={{ textTransform: 'none', padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
            Fuera de servicio
          </span>
        );
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Searching & Pagination
  const filteredMachinery = machinery.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.codigoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.type.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'Todos') return matchesSearch;
    if (statusFilter === 'Disponibles') return matchesSearch && m.status === 'Disponible';
    if (statusFilter === 'Operando') return matchesSearch && m.status === 'Operando';
    if (statusFilter === 'En Mantenimiento') return matchesSearch && m.status === 'En mantenimiento';
    if (statusFilter === 'Fuera de Servicio') return matchesSearch && m.status === 'Fuera de servicio';
    return matchesSearch;
  });

  const paginatedMachinery = filteredMachinery.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const activeMachine = getActiveMachineDetails();
  const activeJornada = activeMachine ? getActiveJornadaForMachine(activeMachine.id) : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Cargando información de flota y operaciones...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── SUB-TABS ROUTING VVIEWS ────────────────────────────────────────────── */}

      {subTab === 'flota' && (
        <>
          {/* Section Header */}
          <div className="section-header">
            <div className="section-title-box">
              <h2>Flota de Maquinaria</h2>
              <p className="section-desc">Gestiona tu flota, operaciones y mantenimientos en tiempo real</p>
            </div>
            <div className="section-actions" style={{ gap: '10px' }}>
              <button className="btn btn-primary" onClick={handleOpenAddDrawer}>
                <Plus size={16} />
                <span>Agregar Equipo</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const disp = machinery.find(m => m.status === 'Disponible');
                  setLaborForm({
                    maquinariaId: disp ? disp.id : '',
                    operator: '',
                    lot: '',
                    activity: 'Preparación de suelo',
                    startHorometro: disp ? disp.hoursOfOperation : 0,
                    startFuel: 100,
                    startTime: new Date().toISOString().substring(0, 16)
                  });
                  setIsStartLaborOpen(true);
                }}
              >
                <Play size={16} style={{ color: 'var(--primary)' }} />
                <span>Iniciar Labor</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setSubTab('reportes')}>
                <BarChart3 size={16} />
                <span>Ver Reportes</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const inMaint = machinery.find(m => m.status === 'Disponible' || m.status === 'En mantenimiento');
                  setMaintForm({
                    maquinariaId: inMaint ? inMaint.id : '',
                    date: new Date().toISOString().split('T')[0],
                    horometro: inMaint ? inMaint.hoursOfOperation : 0,
                    notes: ''
                  });
                  setIsMaintModalOpen(true);
                }}
              >
                <Wrench size={16} />
                <span>Programar Mto.</span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="glass-card primary-edge" style={{ padding: '16px 20px' }}>
              <div className="card-title-section">
                <span className="card-label" style={{ fontSize: '11px' }}>MAQUINARIA TOTAL</span>
                <div className="card-icon-box green" style={{ width: '30px', height: '30px' }}><Tractor size={16} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{totalCount}</div>
              <div className="card-desc" style={{ fontSize: '11px' }}>Equipos registrados</div>
            </div>

            <div className="glass-card info-edge" style={{ padding: '16px 20px' }}>
              <div className="card-title-section">
                <span className="card-label" style={{ fontSize: '11px' }}>OPERANDO AHORA</span>
                <div className="card-icon-box blue" style={{ width: '30px', height: '30px' }}><Activity size={16} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{operatingCount}</div>
              <div className="card-desc" style={{ fontSize: '11px' }}>Equipos en operación</div>
            </div>

            <div className="glass-card warning-edge" style={{ padding: '16px 20px' }}>
              <div className="card-title-section">
                <span className="card-label" style={{ fontSize: '11px' }}>HORAS TRABAJADAS HOY</span>
                <div className="card-icon-box yellow" style={{ width: '30px', height: '30px' }}><Clock size={16} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{totalHoursWorkedToday.toFixed(1)} h</div>
              <div className="card-desc" style={{ fontSize: '11px' }}>Total de la flota</div>
            </div>

            <div className="glass-card info-edge" style={{ padding: '16px 20px' }}>
              <div className="card-title-section">
                <span className="card-label" style={{ fontSize: '11px' }}>CONSUMO HOY</span>
                <div className="card-icon-box red" style={{ width: '30px', height: '30px' }}><Droplet size={16} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{Math.round(totalFuelConsumedToday)} L</div>
              <div className="card-desc" style={{ fontSize: '11px' }}>Combustible total</div>
            </div>

            <div className="glass-card primary-edge" style={{ padding: '16px 20px' }}>
              <div className="card-title-section">
                <span className="card-label" style={{ fontSize: '11px' }}>EFICIENCIA OPERATIVA</span>
                <div className="card-icon-box green" style={{ width: '30px', height: '30px' }}><ShieldCheck size={16} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>92%</div>
              <div className="card-desc" style={{ fontSize: '11px' }}>vs. meta diaria</div>
            </div>
          </div>

          {/* Main Grid: Left is Table & Charts, Right is Operation Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.25fr', gap: '24px', alignItems: 'stretch' }} className="metrics-grid">

            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Table Container glass-card */}
              <div className="glass-card" style={{ padding: '24px' }}>

                {/* Search & Categories Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>

                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-app)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    {[
                      { id: 'Todos', label: 'Todos los Equipos' },
                      { id: 'Operando', label: `Operando (${operatingCount})` },
                      { id: 'En Mantenimiento', label: `En Mto. (${maintenanceCount})` },
                      { id: 'Fuera de Servicio', label: `Fuera de Serv. (${criticalCount})` },
                      { id: 'Disponibles', label: `Disponibles (${availableCount})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                        style={{
                          background: statusFilter === tab.id ? 'var(--primary)' : 'transparent',
                          color: statusFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                          border: 'none',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: statusFilter === tab.id ? 'var(--glow-shadow)' : 'none'
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search and Layout controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Buscar equipo..."
                        className="input-glass"
                        style={{ padding: '6px 12px 6px 30px', fontSize: '12px', width: '180px', height: '32px' }}
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      />
                    </div>
                  </div>

                </div>

                {/* Main Datatable */}
                <div className="table-container" style={{ margin: 0 }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        <th>Tipo</th>
                        <th>Estado Actual</th>
                        <th>Operador</th>
                        <th>Labor Actual</th>
                        <th>Horómetro</th>
                        <th>Horas Hoy</th>
                        <th style={{ textAlign: 'right', paddingRight: '20px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMachinery.length > 0 ? (
                        paginatedMachinery.map(m => {
                          const isActive = getActiveJornadaForMachine(m.id);
                          return (
                            <tr
                              key={m.id}
                              onClick={() => setActiveMachineId(m.id)}
                              style={{
                                cursor: 'pointer',
                                background: activeMachineId === m.id ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
                              }}
                            >
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {m.photoUrl ? (
                                    <img
                                      src={m.photoUrl}
                                      alt={m.name}
                                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : null}
                                  {(!m.photoUrl) && getMachineIcon(m.type)}
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{m.name}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.codigoId}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize: '13px' }}>{m.type}</td>
                              <td>{getStatusBadge(m.status)}</td>
                              <td style={{ fontSize: '13px' }}>
                                {m.operatorName ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={12} style={{ color: 'var(--text-muted)' }} />
                                    <span>{m.operatorName}</span>
                                  </div>
                                ) : '--'}
                              </td>
                              <td>
                                {m.currentTask ? (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '500', fontSize: '13px' }}>{m.currentTask}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.currentLot}</span>
                                  </div>
                                ) : '--'}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '600', fontSize: '13px' }}>{m.hoursOfOperation.toLocaleString('es-ES')} h</span>
                                  <span style={{ fontSize: '11px', color: m.nextMaintenanceHours <= 50 ? 'var(--accent-red)' : 'var(--text-muted)', fontWeight: m.nextMaintenanceHours <= 50 ? '600' : '400' }}>
                                    Próx: {m.nextMaintenanceHours} h
                                  </span>
                                </div>
                              </td>
                              <td style={{ fontSize: '13px', fontWeight: '500' }}>{m.hoursToday > 0 ? `${m.hoursToday.toFixed(1)} h` : '0.0 h'}</td>
                              <td style={{ textAlign: 'right', paddingRight: '20px' }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>

                                  {m.status === 'Disponible' && (
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '6px', borderRadius: '8px' }}
                                      onClick={() => {
                                        setLaborForm({
                                          maquinariaId: m.id,
                                          operator: '',
                                          lot: '',
                                          activity: 'Preparación de suelo',
                                          startHorometro: m.hoursOfOperation,
                                          startFuel: 100,
                                          startTime: new Date().toISOString().substring(0, 16)
                                        });
                                        setIsStartLaborOpen(true);
                                      }}
                                      title="Iniciar Labor"
                                    >
                                      <Play size={12} style={{ color: 'var(--primary)' }} />
                                    </button>
                                  )}

                                  {m.status === 'Operando' && isActive && (
                                    <button
                                      className="btn btn-danger"
                                      style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)' }}
                                      onClick={() => {
                                        setEndLaborForm({
                                          jornadaId: isActive.id,
                                          endTime: new Date().toISOString().substring(0, 16),
                                          endHorometro: m.hoursOfOperation + 4, // estimate some final horometro
                                          endFuel: 70,
                                          notes: ''
                                        });
                                        setIsEndLaborOpen(true);
                                      }}
                                      title="Finalizar Labor"
                                    >
                                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#dc2626', display: 'inline-block' }} />
                                    </button>
                                  )}

                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '6px', borderRadius: '8px' }}
                                    onClick={() => {
                                      setSelectedMachine(m);
                                      setIsDetailModalOpen(true);
                                    }}
                                    title="Ver Detalles"
                                  >
                                    <Eye size={12} />
                                  </button>

                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '6px', borderRadius: '8px' }}
                                    onClick={() => handleOpenEditDrawer(m)}
                                    title="Editar"
                                  >
                                    <Pencil size={12} />
                                  </button>

                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '6px', borderRadius: '8px' }}
                                    onClick={() => handleDeleteMachine(m.id)}
                                    title="Eliminar"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                            No se encontraron maquinarias.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Mostrando {Math.min(filteredMachinery.length, (currentPage - 1) * rowsPerPage + 1)} a {Math.min(filteredMachinery.length, currentPage * rowsPerPage)} de {filteredMachinery.length} equipos
                  </span>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      &lt;
                    </button>
                    {[...Array(Math.ceil(filteredMachinery.length / rowsPerPage) || 1)].map((_, idx) => (
                      <button
                        key={idx}
                        className={`btn ${currentPage === idx + 1 ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => setCurrentPage(idx + 1)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      disabled={currentPage === Math.ceil(filteredMachinery.length / rowsPerPage)}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      &gt;
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column: Operación Actual & Widgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Operación Actual panel */}
              <div className="glass-card primary-edge" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>OPERACIÓN ACTUAL</h3>
                  <span className={`badge ${activeJornada ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '10px', textTransform: 'none', padding: '2px 8px' }}>
                    {activeJornada ? '● En progreso' : '● Inactivo'}
                  </span>
                </div>

                {activeMachine ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {activeMachine.photoUrl ? (
                      <img
                        src={activeMachine.photoUrl}
                        alt={activeMachine.name}
                        style={{ width: '100%', height: '140px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '140px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        {getMachineIcon(activeMachine.type)}
                      </div>
                    )}

                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: '800' }}>{activeMachine.name}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {activeMachine.codigoId}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Operador:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{activeMachine.operatorName || '--'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Labor:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{activeMachine.currentTask || '--'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Lote:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{activeJornada?.lot || activeMachine.currentLot || '--'}</strong>
                      </div>

                      {activeJornada && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Inicio:</span>
                            <span style={{ fontWeight: '500' }}>{formatDateTime(activeJornada.startTime)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Horómetro inicial:</span>
                            <span style={{ fontWeight: '500' }}>{activeJornada.startHorometro.toLocaleString()} h</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Horas trabajadas:</span>
                            <strong style={{ color: 'var(--primary)' }}>{activeMachine.hoursToday.toFixed(1)} h</strong>
                          </div>
                        </>
                      )}
                    </div>

                    {activeJornada ? (
                      <button
                        className="btn btn-danger"
                        style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                        onClick={() => {
                          setEndLaborForm({
                            jornadaId: activeJornada.id,
                            endTime: new Date().toISOString().substring(0, 16),
                            endHorometro: activeMachine.hoursOfOperation + activeMachine.hoursToday,
                            endFuel: Math.max(0, activeJornada.startFuel - 20),
                            notes: ''
                          });
                          setIsEndLaborOpen(true);
                        }}
                      >
                        Finalizar Labor
                      </button>
                    ) : activeMachine.status === 'Disponible' ? (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                        onClick={() => {
                          setLaborForm({
                            maquinariaId: activeMachine.id,
                            operator: '',
                            lot: '',
                            activity: 'Preparación de suelo',
                            startHorometro: activeMachine.hoursOfOperation,
                            startFuel: 100,
                            startTime: new Date().toISOString().substring(0, 16)
                          });
                          setIsStartLaborOpen(true);
                        }}
                      >
                        Iniciar Labor
                      </button>
                    ) : (
                      <div style={{ padding: '10px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Equipo en mantenimiento o inhabilitado.
                      </div>
                    )}

                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Selecciona un equipo de la lista para ver su estado operacional.
                  </div>
                )}
              </div>

              {/* Actividad Reciente widget */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Actividad Reciente</h3>
                  <button className="btn" style={{ padding: '2px 6px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--primary)' }} onClick={() => setSubTab('historial')}>
                    Ver todo
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  {jornadas.slice(0, 4).map(j => (
                    <div key={j.id} style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: j.status === 'En Progreso' ? 'var(--primary)' : 'var(--text-muted)'
                        }} />
                        <div style={{ width: '1px', flexGrow: 1, background: 'var(--border-color)', marginTop: '4px' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '600' }}>{j.maquinariaCodigo}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {j.status === 'En Progreso' ? `Inició labor en ${j.lot}` : `Finalizó labor en ${j.lot}`}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {formatDateTime(j.startTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Próximos Mantenimientos widget */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Próximos Mantenimientos</h3>
                  <button className="btn" style={{ padding: '2px 6px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--primary)' }} onClick={() => setSubTab('mantenimientos')}>
                    Ver todos
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {machinery
                    .filter(m => m.nextMaintenanceHours <= 100)
                    .slice(0, 3)
                    .map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <AlertTriangle size={14} style={{ color: m.nextMaintenanceHours <= 20 ? 'var(--accent-red)' : 'var(--accent-gold)' }} />
                          <div>
                            <div style={{ fontWeight: '600' }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.codigoId}</div>
                          </div>
                        </div>
                        <span className={`badge ${m.nextMaintenanceHours <= 20 ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                          En {m.nextMaintenanceHours} h
                        </span>
                      </div>
                    ))}
                </div>
              </div>

            </div>

          </div>

          {/* Lower Section: SVG Reports/Dashboard summary charts */}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

            {/* Chart 1: Horas Trabajadas */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700' }}>HORAS TRABAJADAS (7 DÍAS)</h3>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>124.5 h</span>
              </div>
              <svg viewBox="0 0 300 120" style={{ width: '100%', height: '100px' }}>
                {/* Grid Lines */}
                <line x1="20" y1="20" x2="280" y2="20" stroke="var(--border-color)" strokeWidth="0.5" />
                <line x1="20" y1="50" x2="280" y2="50" stroke="var(--border-color)" strokeWidth="0.5" />
                <line x1="20" y1="80" x2="280" y2="80" stroke="var(--border-color)" strokeWidth="0.5" />
                <line x1="20" y1="100" x2="280" y2="100" stroke="var(--text-muted)" strokeWidth="1" />

                {/* Trend line */}
                <path
                  d="M20,95 L63,60 L106,75 L149,70 L192,62 L235,68 L278,35"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Area under trend */}
                <path
                  d="M20,95 L63,60 L106,75 L149,70 L192,62 L235,68 L278,35 L278,100 L20,100 Z"
                  fill="rgba(16, 185, 129, 0.08)"
                />

                {/* Points */}
                <circle cx="20" cy="95" r="4" fill="var(--primary)" />
                <circle cx="63" cy="60" r="4" fill="var(--primary)" />
                <circle cx="106" cy="75" r="4" fill="var(--primary)" />
                <circle cx="149" cy="70" r="4" fill="var(--primary)" />
                <circle cx="192" cy="62" r="4" fill="var(--primary)" />
                <circle cx="235" cy="68" r="4" fill="var(--primary)" />
                <circle cx="278" cy="35" r="4" fill="var(--primary)" />

                {/* X labels */}
                <text x="20" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">20 may</text>
                <text x="106" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">22 may</text>
                <text x="192" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">24 may</text>
                <text x="278" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">26 may</text>
              </svg>
            </div>

            {/* Chart 2: Distribución de Horas */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>DISTRIBUCIÓN DE HORAS POR TIPO</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px' }}>
                  {/* Donut Chart representation with strokes */}
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#16a34a" strokeWidth="15" strokeDasharray="251" strokeDashoffset="120" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ea580c" strokeWidth="15" strokeDasharray="251" strokeDashoffset="210" transform="rotate(187 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2563eb" strokeWidth="15" strokeDasharray="251" strokeDashoffset="230" transform="rotate(245 50 50)" />
                </svg>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
                    <span>Tractores (52%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c' }} />
                    <span>Cosechadoras (20%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }} />
                    <span>Otros (28%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 3: Consumo de Combustible */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700' }}>CONSUMO COMBUSTIBLE (7 DÍAS)</h3>
                <span style={{ fontSize: '14px', fontWeight: '700' }}><Droplet size={14} style={{ display: 'inline', marginRight: '4px' }} />1,892 L</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', margin: '10px 0' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Promedio diario</span>
                  <p style={{ fontWeight: '600' }}>270 L</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Costo estimado</span>
                  <p style={{ fontWeight: '600' }}>$9,460,000 COP</p>
                </div>
              </div>

              {/* Minimal bar chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '40px', marginTop: '10px' }}>
                {[30, 45, 38, 55, 48, 62, 50].map((h, i) => (
                  <div key={i} style={{ flexGrow: 1, background: 'rgba(239, 68, 68, 0.1)', height: `${h}%`, borderRadius: '3px 3px 0 0', position: 'relative' }}>
                    <div style={{ background: '#ea580c', height: '100%', width: '100%', borderRadius: '3px 3px 0 0' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 4: Eficiencia de la Flota */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>EFICIENCIA DE LA FLOTA</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>Meta Diaria</span>
                    <strong style={{ color: 'var(--primary)' }}>92%</strong>
                  </div>
                  <div className="progress-bar-container" style={{ height: '6px' }}>
                    <div className="progress-bar-fill" style={{ width: '92%' }}></div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <div>Disponibilidad: <strong>88%</strong></div>
                  <div>Utilización: <strong>94%</strong></div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ── INTERNAL VIEWS ─────────────────────────────────────────────────── */}

      {subTab === 'operaciones' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Historial de Operaciones / Jornadas de Trabajo</h3>
            <button
              className="btn btn-primary"
              onClick={() => {
                const disp = machinery.find(m => m.status === 'Disponible');
                setLaborForm({
                  maquinariaId: disp ? disp.id : '',
                  operator: '',
                  lot: '',
                  activity: 'Preparación de suelo',
                  startHorometro: disp ? disp.hoursOfOperation : 0,
                  startFuel: 100,
                  startTime: new Date().toISOString().substring(0, 16)
                });
                setIsStartLaborOpen(true);
              }}
            >
              <Plus size={16} />
              Iniciar Nueva Jornada
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Operador</th>
                  <th>Lote</th>
                  <th>Actividad</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Horas</th>
                  <th>Combustible Consumido</th>
                  <th>Costo Estimado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {jornadas.length > 0 ? (
                  jornadas.map(j => (
                    <tr key={j.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getMachineIcon(j.maquinariaType)}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600' }}>{j.maquinariaCodigo}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{j.maquinariaName}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: '500' }}>{j.operator}</td>
                      <td>{j.lot}</td>
                      <td>{j.activity}</td>
                      <td>{formatDateTime(j.startTime)}</td>
                      <td>{j.endTime ? formatDateTime(j.endTime) : '--'}</td>
                      <td>{j.status === 'Finalizada' ? `${j.calculatedHours.toFixed(1)} h` : 'En progreso'}</td>
                      <td>{j.status === 'Finalizada' ? `${j.calculatedFuelConsumption} L` : '--'}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        {j.status === 'Finalizada' ? `$${j.calculatedCost.toLocaleString()}` : '--'}
                      </td>
                      <td>
                        <span className={`badge ${j.status === 'Finalizada' ? 'badge-green' : 'badge-blue'}`}>
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No hay registros de jornadas operativas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'mantenimientos' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Calendario y Control de Mantenimientos Preventivos</h3>
            <button
              className="btn btn-primary"
              onClick={() => {
                const inMaint = machinery.find(m => m.status === 'Disponible' || m.status === 'En mantenimiento');
                setMaintForm({
                  maquinariaId: inMaint ? inMaint.id : '',
                  date: new Date().toISOString().split('T')[0],
                  horometro: inMaint ? inMaint.hoursOfOperation : 0,
                  notes: ''
                });
                setIsMaintModalOpen(true);
              }}
            >
              <Plus size={16} />
              Programar Mantenimiento
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {machinery
              .filter(m => m.nextMaintenanceHours <= 100 || m.status === 'En mantenimiento')
              .map(m => (
                <div key={m.id} className="glass-card danger-edge" style={{ borderLeftWidth: m.nextMaintenanceHours <= 20 ? '4px' : '2px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontWeight: '700' }}>{m.codigoId} · {m.name}</h4>
                    {getStatusBadge(m.status)}
                  </div>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>Horómetro Actual: <strong>{m.hoursOfOperation.toLocaleString()} h</strong></div>
                    <div>Horas Restantes para Servicio: <strong style={{ color: m.nextMaintenanceHours <= 20 ? 'var(--accent-red)' : 'var(--accent-gold)' }}>{m.nextMaintenanceHours} h</strong></div>
                    <div>Próxima fecha estimada: <strong>{formatDateShort(m.nextMaintenance)}</strong></div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '6px', fontSize: '12px', justifyContent: 'center', marginTop: '12px' }}
                    onClick={() => {
                      setMaintForm({
                        maquinariaId: m.id,
                        date: new Date().toISOString().split('T')[0],
                        horometro: m.hoursOfOperation,
                        notes: ''
                      });
                      setIsMaintModalOpen(true);
                    }}
                  >
                    Registrar Servicio Realizado
                  </button>
                </div>
              ))}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Tipo</th>
                  <th>Horómetro</th>
                  <th>Último Mantenimiento</th>
                  <th>Próximo Mto. (Fecha)</th>
                  <th>Próximo Mto. (Horas)</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {machinery.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.codigoId}</strong> - {m.name}</td>
                    <td>{m.type}</td>
                    <td>{m.hoursOfOperation.toLocaleString()} h</td>
                    <td>{formatDateShort(m.lastMaintenance)}</td>
                    <td>{formatDateShort(m.nextMaintenance)}</td>
                    <td style={{ color: m.nextMaintenanceHours <= 50 ? 'var(--accent-red)' : 'inherit', fontWeight: m.nextMaintenanceHours <= 50 ? '600' : '400' }}>
                      En {m.nextMaintenanceHours} horas
                    </td>
                    <td>{getStatusBadge(m.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px' }}
                        onClick={() => {
                          setMaintForm({
                            maquinariaId: m.id,
                            date: new Date().toISOString().split('T')[0],
                            horometro: m.hoursOfOperation,
                            notes: ''
                          });
                          setIsMaintModalOpen(true);
                        }}
                      >
                        Service
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'combustible' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Monitoreo de Consumo y Carga de Combustible</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Consumo acumulado hoy: <strong style={{ color: 'var(--primary)' }}>{Math.round(totalFuelConsumedToday)} Litros</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="glass-card info-edge" style={{ padding: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PRECIO DE DIESEL</span>
              <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>$4,100 / Litro</div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Costo base estimado ERP</span>
            </div>

            <div className="glass-card primary-edge" style={{ padding: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONSUMO PROMEDIO FLOTA</span>
              <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>16.8 L / hora</div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Durante labores activas</span>
            </div>

            <div className="glass-card warning-edge" style={{ padding: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MAYOR CONSUMIDOR HOY</span>
              <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>CO-002</div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>28.0 L/h - Cosechadora</span>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Tipo</th>
                  <th>Operador Asignado</th>
                  <th>Consumo Estándar</th>
                  <th>Horas Hoy</th>
                  <th>Litros Consumidos Hoy</th>
                  <th>Costo Combustible Hoy</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {machinery.map(m => {
                  const burnRate = parseFloat(m.fuelConsumption) || 0;
                  const consumed = m.status === 'Operando' ? burnRate * (m.hoursToday || 6) : 0;
                  const cost = consumed * m.costFuel;
                  return (
                    <tr key={m.id}>
                      <td><strong>{m.codigoId}</strong> - {m.name}</td>
                      <td>{m.type}</td>
                      <td>{m.operatorName || '--'}</td>
                      <td>{m.fuelConsumption}</td>
                      <td>{m.hoursToday > 0 ? `${m.hoursToday.toFixed(1)} h` : '0.0 h'}</td>
                      <td>{consumed > 0 ? `${consumed.toFixed(1)} L` : '0.0 L'}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        {cost > 0 ? `$${Math.round(cost).toLocaleString()}` : '--'}
                      </td>
                      <td>{getStatusBadge(m.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'historial' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Historial Histórico y Trazabilidad de Flota</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px' }}>Filtrar por Equipo:</span>
              <select
                className="input-glass select-glass"
                style={{ width: '200px', padding: '4px 10px', fontSize: '13px' }}
                value={activeMachineId || ''}
                onChange={e => setActiveMachineId(e.target.value)}
              >
                {machinery.map(m => (
                  <option key={m.id} value={m.id}>{m.codigoId} - {m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {activeMachine ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>

              {/* Left detail card */}
              <div className="glass-card primary-edge" style={{ padding: '20px', alignSelf: 'flex-start' }}>
                <img
                  src={activeMachine.photoUrl}
                  alt={activeMachine.name}
                  style={{ width: '100%', height: '150px', borderRadius: '12px', objectFit: 'cover', marginBottom: '14px' }}
                />
                <h4 style={{ fontSize: '16px', fontWeight: '800' }}>{activeMachine.name}</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Código: {activeMachine.codigoId} · Categoría: {activeMachine.type}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div>Horas Totales: <strong>{activeMachine.hoursOfOperation.toLocaleString()} h</strong></div>
                  <div>Último Mto: <strong>{formatDateShort(activeMachine.lastMaintenance)}</strong></div>
                  <div>Próximo Mto: <strong>{formatDateShort(activeMachine.nextMaintenance)}</strong></div>
                  <div>Consumo: <strong>{activeMachine.fuelConsumption}</strong></div>
                  <div>Costo Operativo Base: <strong style={{ color: 'var(--primary)' }}>${(activeMachine.costOperator + activeMachine.costFuel + activeMachine.costMaintenance + activeMachine.costDepreciation).toFixed(2)}/h</strong></div>
                </div>
              </div>

              {/* Timeline view */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700' }}>Línea de Tiempo Operacional</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '20px', marginLeft: '10px' }}>
                  {jornadas.filter(j => j.maquinariaId === activeMachine.id).map(j => (
                    <div key={j.id} style={{ position: 'relative' }}>
                      {/* Timeline dot */}
                      <span style={{
                        position: 'absolute',
                        left: '-25px',
                        top: '4px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: j.status === 'En Progreso' ? 'var(--primary)' : 'var(--text-muted)'
                      }} />

                      <div className="glass-card" style={{ padding: '14px', background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', background: j.status === 'En Progreso' ? 'var(--primary-light)' : '#e5e7eb', color: j.status === 'En Progreso' ? 'var(--primary)' : '#4b5563', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                            {j.status === 'En Progreso' ? 'Labor Iniciada' : 'Labor Finalizada'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDateTime(j.startTime)}</span>
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          <div>Operador: <strong>{j.operator}</strong></div>
                          <div>Labor: <strong>{j.activity}</strong> en <strong>{j.lot}</strong></div>
                          {j.status === 'Finalizada' && (
                            <div style={{ marginTop: '6px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>Horas: <strong>{j.calculatedHours.toFixed(1)} h</strong></div>
                              <div>Combustible: <strong>{j.calculatedFuelConsumption.toFixed(1)} L</strong></div>
                              <div>Costo labor: <strong style={{ color: 'var(--primary)' }}>${j.calculatedCost.toLocaleString()}</strong></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {jornadas.filter(j => j.maquinariaId === activeMachine.id).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                      No hay registros operativos anteriores para este equipo.
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando información del equipo...
            </div>
          )}
        </div>
      )}

      {subTab === 'costos' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Centro de Costos Operativos de Maquinaria</h3>
            <p className="section-desc">Configuración de costos por hora y análisis automático por lote y hectárea</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>

            {/* Left form - configure machinery costs */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>Configurar Tarifas por Hora</h4>

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Seleccionar Equipo</label>
                <select
                  className="input-glass select-glass"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={selectedMachine ? selectedMachine.id : ''}
                  onChange={e => {
                    const found = machinery.find(m => m.id === e.target.value);
                    setSelectedMachine(found);
                  }}
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {machinery.map(m => (
                    <option key={m.id} value={m.id}>{m.codigoId} - {m.name}</option>
                  ))}
                </select>
              </div>

              {selectedMachine ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const { error } = await supabase
                      .from('maquinaria')
                      .update({
                        cost_operator: selectedMachine.costOperator,
                        cost_fuel: selectedMachine.costFuel,
                        cost_maintenance: selectedMachine.costMaintenance,
                        cost_depreciation: selectedMachine.costDepreciation
                      })
                      .eq('id', selectedMachine.id);
                    if (error) throw error;
                    alert("Tarifas de costos actualizadas para " + selectedMachine.codigoId);
                    await fetchData();
                  } catch (err) {
                    alert("Error al actualizar costos: " + err.message);
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="form-label">Costo Operador ($/h)</label>
                      <input
                        type="number"
                        className="input-glass"
                        style={{ width: '100%', fontSize: '13px' }}
                        value={selectedMachine.costOperator}
                        onChange={e => setSelectedMachine(prev => ({ ...prev, costOperator: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Costo Combustible ($/h)</label>
                      <input
                        type="number"
                        className="input-glass"
                        style={{ width: '100%', fontSize: '13px' }}
                        value={selectedMachine.costFuel}
                        onChange={e => setSelectedMachine(prev => ({ ...prev, costFuel: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="form-label">Costo Mantenimiento ($/h)</label>
                      <input
                        type="number"
                        className="input-glass"
                        style={{ width: '100%', fontSize: '13px' }}
                        value={selectedMachine.costMaintenance}
                        onChange={e => setSelectedMachine(prev => ({ ...prev, costMaintenance: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Costo Depreciación ($/h)</label>
                      <input
                        type="number"
                        className="input-glass"
                        style={{ width: '100%', fontSize: '13px' }}
                        value={selectedMachine.costDepreciation}
                        onChange={e => setSelectedMachine(prev => ({ ...prev, costDepreciation: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-app)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', marginTop: '6px' }}>
                    Costo Total Estimado: <strong style={{ color: 'var(--primary)' }}>${(selectedMachine.costOperator + selectedMachine.costFuel + selectedMachine.costMaintenance + selectedMachine.costDepreciation).toFixed(2)} por hora</strong>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                    Guardar Tarifas
                  </button>

                </form>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Selecciona una máquina para configurar sus costos.
                </div>
              )}
            </div>

            {/* Right details - Cost per Lot/Hectare charts & statistics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Costo Total por Lote (Historial de Labores)</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { lot: 'Lote B-12', cost: 1240000, hours: 24.5 },
                    { lot: 'Lote M-05', cost: 890000, hours: 18.0 },
                    { lot: 'Lote C-08', cost: 580000, hours: 12.2 },
                    { lot: 'Lote S-02', cost: 420000, hours: 10.0 }
                  ].map((stat, idx) => (
                    <div key={idx} style={{ fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span>{stat.lot} ({stat.hours} hs)</span>
                        <strong>${stat.cost.toLocaleString()} COP</strong>
                      </div>
                      <div className="progress-bar-container" style={{ height: '5px', margin: 0 }}>
                        <div className="progress-bar-fill" style={{ width: `${(stat.cost / 1240000) * 100}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent-cyan))' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Costo Promedio por Hectárea</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PREPARACIÓN SUELO</span>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>$85,000 / Ha</h3>
                  </div>
                  <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COSECHA MAÍZ</span>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>$112,000 / Ha</h3>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {subTab === 'alertas' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Panel de Alertas y Notificaciones de Flota</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {machinery
              .filter(m => m.nextMaintenanceHours <= 50)
              .map(m => (
                <div key={m.id} style={{ display: 'flex', gap: '14px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px', alignItems: 'center' }}>
                  <AlertOctagon size={24} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                  <div style={{ flexGrow: 1, fontSize: '13px' }}>
                    <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Mantenimiento Crítico Requerido: {m.codigoId}</h4>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                      El equipo <strong>{m.name}</strong> ha trabajado {m.hoursOfOperation.toLocaleString()} horas y se encuentra a {m.nextMaintenanceHours} horas del límite programado.
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                    onClick={() => {
                      setMaintForm({
                        maquinariaId: m.id,
                        date: new Date().toISOString().split('T')[0],
                        horometro: m.hoursOfOperation,
                        notes: ''
                      });
                      setIsMaintModalOpen(true);
                    }}
                  >
                    Registrar Servicio
                  </button>
                </div>
              ))}

            {machinery.filter(m => m.status === 'Fuera de servicio').map(m => (
              <div key={m.id} style={{ display: 'flex', gap: '14px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px', alignItems: 'center' }}>
                <AlertTriangle size={24} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                <div style={{ flexGrow: 1, fontSize: '13px' }}>
                  <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Equipo fuera de servicio: {m.codigoId}</h4>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    <strong>{m.name}</strong> requiere inspección mecánica o repuestos técnicos urgentes.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => {
                    const currentSelected = machinery.find(mac => mac.id === m.id);
                    setSelectedMachine(currentSelected);
                    setIsEditMachineOpen(true);
                  }}
                >
                  Editar Estado
                </button>
              </div>
            ))}

            {machinery.filter(m => m.nextMaintenanceHours > 50 && m.nextMaintenanceHours <= 100).map(m => (
              <div key={m.id} style={{ display: 'flex', gap: '14px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px', padding: '16px', alignItems: 'center' }}>
                <AlertTriangle size={24} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                <div style={{ flexGrow: 1, fontSize: '13px' }}>
                  <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Mantenimiento Próximo: {m.codigoId}</h4>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    <strong>{m.name}</strong> se acerca a su mantenimiento de rutina en {m.nextMaintenanceHours} horas de operación acumuladas.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'reportes' && (
        <div className="glass-card">
          <div className="drawer-header" style={{ marginBottom: '20px' }}>
            <h3>Informes de Rendimiento y Reportes de Flota</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Eficiencia de Labor por Operador</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {[
                  { op: 'Juan Pérez', rate: '94% (Excelente)' },
                  { op: 'Carlos Ruiz', rate: '92% (Excelente)' },
                  { op: 'Sofia Diaz', rate: '89% (Óptimo)' },
                  { op: 'Mateo Ortiz', rate: '85% (Regular)' }
                ].map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span>{row.op}</span>
                    <strong>{row.rate}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Distribución de Costos Totales</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {[
                  { label: 'Combustible (Diesel)', pct: 45 },
                  { label: 'Pago Operadores', pct: 30 },
                  { label: 'Servicio & Repuestos', pct: 15 },
                  { label: 'Depreciación Maquinaria', pct: 10 }
                ].map((row, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                      <span>{row.label}</span>
                      <strong>{row.pct}%</strong>
                    </div>
                    <div className="progress-bar-container" style={{ height: '6px', margin: 0 }}>
                      <div className="progress-bar-fill" style={{ width: `${row.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS & DRAWERS ─────────────────────────────────────────────────── */}

      {/* Modal Iniciar Labor */}
      {isStartLaborOpen && (
        <div className="drawer-backdrop" onClick={() => setIsStartLaborOpen(false)}>
          <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Iniciar Labor Agrícola</h3>
              <button className="btn btn-secondary" onClick={() => setIsStartLaborOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStartLabor} className="drawer-form">
              <div>
                <label className="form-label">Maquinaria Disponible</label>
                <select
                  className="input-glass select-glass"
                  style={{ width: '100%', fontSize: '13px' }}
                  required
                  value={laborForm.maquinariaId}
                  onChange={e => {
                    const id = e.target.value;
                    const target = machinery.find(m => m.id === id);
                    setLaborForm(prev => ({
                      ...prev,
                      maquinariaId: id,
                      startHorometro: target ? target.hoursOfOperation : 0
                    }));
                  }}
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {machinery
                    .filter(m => m.status === 'Disponible')
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.codigoId} - {m.name} ({m.hoursOfOperation.toLocaleString()} h)</option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Operador Asignado</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    placeholder="Ej. Juan Pérez"
                    required
                    value={laborForm.operator}
                    onChange={e => setLaborForm(prev => ({ ...prev, operator: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Lote / Campo</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    placeholder="Ej. Lote B-12"
                    required
                    value={laborForm.lot}
                    onChange={e => setLaborForm(prev => ({ ...prev, lot: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Actividad Agrícola</label>
                <select
                  className="input-glass select-glass"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={laborForm.activity}
                  onChange={e => setLaborForm(prev => ({ ...prev, activity: e.target.value }))}
                >
                  <option value="Preparación de suelo">Preparación de suelo</option>
                  <option value="Siembra de soya">Siembra de soya</option>
                  <option value="Cosecha de maíz">Cosecha de maíz</option>
                  <option value="Aplicación fungicida">Aplicación fungicida</option>
                  <option value="Riego automatizado">Riego automatizado</option>
                  <option value="Transporte de granos">Transporte de granos</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Horómetro Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    required
                    value={laborForm.startHorometro}
                    onChange={e => setLaborForm(prev => ({ ...prev, startHorometro: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Combustible Inicial (L)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    required
                    value={laborForm.startFuel}
                    onChange={e => setLaborForm(prev => ({ ...prev, startFuel: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Hora de Inicio</label>
                <input
                  type="datetime-local"
                  className="input-glass"
                  style={{ width: '100%', fontSize: '13px' }}
                  required
                  value={laborForm.startTime}
                  onChange={e => setLaborForm(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                Iniciar y Registrar Labor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Finalizar Labor */}
      {isEndLaborOpen && (
        <div className="drawer-backdrop" onClick={() => setIsEndLaborOpen(false)}>
          <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Finalizar Labor Agrícola</h3>
              <button className="btn btn-secondary" onClick={() => setIsEndLaborOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEndLabor} className="drawer-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Horómetro Final</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    required
                    value={endLaborForm.endHorometro}
                    onChange={e => setEndLaborForm(prev => ({ ...prev, endHorometro: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Combustible Restante (L)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    required
                    value={endLaborForm.endFuel}
                    onChange={e => setEndLaborForm(prev => ({ ...prev, endFuel: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Hora Final</label>
                <input
                  type="datetime-local"
                  className="input-glass"
                  style={{ width: '100%', fontSize: '13px' }}
                  required
                  value={endLaborForm.endTime}
                  onChange={e => setEndLaborForm(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Observaciones / Notas del día</label>
                <textarea
                  className="input-glass"
                  style={{ width: '100%', minHeight: '60px', fontSize: '13px', resize: 'vertical' }}
                  placeholder="Ej. Preparación completada, terreno en buenas condiciones..."
                  value={endLaborForm.notes}
                  onChange={e => setEndLaborForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                Guardar y Detener Maquinaria
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Programar/Registrar Mantenimiento */}
      {isMaintModalOpen && (
        <div className="drawer-backdrop" onClick={() => setIsMaintModalOpen(false)}>
          <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Registrar Mantenimiento</h3>
              <button className="btn btn-secondary" onClick={() => setIsMaintModalOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterMaintenance} className="drawer-form">
              <div>
                <label className="form-label">Equipo de Flota</label>
                <select
                  className="input-glass select-glass"
                  style={{ width: '100%', fontSize: '13px' }}
                  required
                  value={maintForm.maquinariaId}
                  onChange={e => {
                    const id = e.target.value;
                    const target = machinery.find(m => m.id === id);
                    setMaintForm(prev => ({
                      ...prev,
                      maquinariaId: id,
                      horometro: target ? target.hoursOfOperation : 0
                    }));
                  }}
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {machinery.map(m => (
                    <option key={m.id} value={m.id}>{m.codigoId} - {m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Fecha del Servicio</label>
                  <input
                    type="date"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    required
                    value={maintForm.date}
                    onChange={e => setMaintForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Horómetro de Servicio</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%', fontSize: '13px' }}
                    required
                    value={maintForm.horometro}
                    onChange={e => setMaintForm(prev => ({ ...prev, horometro: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Notas del Servicio / Ajustes</label>
                <textarea
                  className="input-glass"
                  style={{ width: '100%', minHeight: '60px', fontSize: '13px', resize: 'vertical' }}
                  placeholder="Ej. Cambio de filtros, aceite hidráulico, lubricación de uniones..."
                  value={maintForm.notes}
                  onChange={e => setMaintForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                Habilitar y Programar Próximo Ciclo (+250 h)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Drawer Agregar Equipo */}
      {isAddMachineOpen && (
        <div className="drawer-backdrop" onClick={() => setIsAddMachineOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Agregar Maquinaria a la Flota</h3>
              <button className="btn btn-secondary" onClick={() => setIsAddMachineOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form className="drawer-form" onSubmit={handleAddMachine}>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Código ID (Placa/Interno)</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. TR-001"
                    required
                    value={newMachine.codigoId}
                    onChange={e => setNewMachine(prev => ({ ...prev, codigoId: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Nombre del Equipo</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. Tractor John Deere 6195R"
                    required
                    value={newMachine.name}
                    onChange={e => setNewMachine(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Tipo de Equipo</label>
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={newMachine.type}
                    onChange={e => setNewMachine(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="Tractor">Tractor</option>
                    <option value="Cosechadora">Cosechadora</option>
                    <option value="Sembradora">Sembradora</option>
                    <option value="Pulverizadora">Pulverizadora</option>
                    <option value="Dron">Dron Agrícola</option>
                    <option value="Riego">Equipo de Riego</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Retroexcavadora">Retroexcavadora</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Consumo Estimado (L/h)</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. 15.5 L/h o Eléctrico"
                    value={newMachine.fuelConsumption}
                    onChange={e => setNewMachine(prev => ({ ...prev, fuelConsumption: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Horómetro Inicial</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={newMachine.hoursOfOperation}
                    onChange={e => setNewMachine(prev => ({ ...prev, hoursOfOperation: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Frecuencia Mantenimiento (Horas)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    placeholder="Ej. 250"
                    value={newMachine.nextMaintenanceHours}
                    onChange={e => setNewMachine(prev => ({ ...prev, nextMaintenanceHours: parseInt(e.target.value) || 250 }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Costo Operador ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={newMachine.costOperator}
                    onChange={e => setNewMachine(prev => ({ ...prev, costOperator: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Costo Combustible ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={newMachine.costFuel}
                    onChange={e => setNewMachine(prev => ({ ...prev, costFuel: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Costo Mantenimiento ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={newMachine.costMaintenance}
                    onChange={e => setNewMachine(prev => ({ ...prev, costMaintenance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Costo Depreciación ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={newMachine.costDepreciation}
                    onChange={e => setNewMachine(prev => ({ ...prev, costDepreciation: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Foto del Equipo</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {uploading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--primary-light)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Subiendo imagen...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {newMachine.photoUrl ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={newMachine.photoUrl}
                            alt="Vista previa"
                            style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                          />
                          <button
                            type="button"
                            onClick={() => setNewMachine(prev => ({ ...prev, photoUrl: '' }))}
                            style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-red)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '9px' }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                          <Tractor size={18} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}

                      <div style={{ position: 'relative' }}>
                        <input
                          type="file"
                          accept="image/*"
                          id="add-photo-file"
                          style={{ display: 'none' }}
                          onChange={(e) => handleImageUpload(e, false)}
                        />
                        <label
                          htmlFor="add-photo-file"
                          className="btn btn-secondary"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Plus size={14} />
                          <span>Seleccionar archivo</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Estado Inicial</label>
                <select
                  className="input-glass select-glass"
                  style={{ width: '100%' }}
                  value={newMachine.status}
                  onChange={e => setNewMachine(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Operando">Operando</option>
                  <option value="En mantenimiento">En mantenimiento</option>
                  <option value="Fuera de servicio">Fuera de servicio</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsAddMachineOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                  Registrar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer Editar Equipo */}
      {isEditMachineOpen && selectedMachine && (
        <div className="drawer-backdrop" onClick={() => setIsEditMachineOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Editar Información de Maquinaria</h3>
              <button className="btn btn-secondary" onClick={() => setIsEditMachineOpen(false)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form className="drawer-form" onSubmit={handleEditMachine}>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Código ID (Fijo)</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    disabled
                    value={selectedMachine.codigoId}
                  />
                </div>
                <div>
                  <label className="form-label">Nombre del Equipo</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    required
                    value={selectedMachine.name}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Tipo de Equipo</label>
                  <select
                    className="input-glass select-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.type}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="Tractor">Tractor</option>
                    <option value="Cosechadora">Cosechadora</option>
                    <option value="Sembradora">Sembradora</option>
                    <option value="Pulverizadora">Pulverizadora</option>
                    <option value="Dron">Dron Agrícola</option>
                    <option value="Riego">Equipo de Riego</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Retroexcavadora">Retroexcavadora</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Consumo Estimado (L/h)</label>
                  <input
                    type="text"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.fuelConsumption}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, fuelConsumption: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Horómetro de Operación</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.hoursOfOperation}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, hoursOfOperation: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Mto. Frecuencia (Horas)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.nextMaintenanceHours}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, nextMaintenanceHours: parseInt(e.target.value) || 250 }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Costo Operador ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.costOperator}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costOperator: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Costo Combustible ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.costFuel}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costFuel: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Costo Mantenimiento ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.costMaintenance}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costMaintenance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Costo Depreciación ($/h)</label>
                  <input
                    type="number"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={selectedMachine.costDepreciation}
                    onChange={e => setSelectedMachine(prev => ({ ...prev, costDepreciation: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Foto del Equipo</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {uploading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--primary-light)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Subiendo imagen...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {selectedMachine.photoUrl ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={selectedMachine.photoUrl}
                            alt="Vista previa"
                            style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedMachine(prev => ({ ...prev, photoUrl: '' }))}
                            style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-red)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '9px' }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                          <Tractor size={18} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}

                      <div style={{ position: 'relative' }}>
                        <input
                          type="file"
                          accept="image/*"
                          id="edit-photo-file"
                          style={{ display: 'none' }}
                          onChange={(e) => handleImageUpload(e, true)}
                        />
                        <label
                          htmlFor="edit-photo-file"
                          className="btn btn-secondary"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Plus size={14} />
                          <span>Seleccionar archivo</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Estado</label>
                <select
                  className="input-glass select-glass"
                  style={{ width: '100%' }}
                  value={selectedMachine.status}
                  onChange={e => setSelectedMachine(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Operando">Operando</option>
                  <option value="En mantenimiento">En mantenimiento</option>
                  <option value="Fuera de servicio">Fuera de servicio</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsEditMachineOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha Técnica */}
      {isDetailModalOpen && selectedMachine && (
        <div className="drawer-backdrop" onClick={() => { setIsDetailModalOpen(false); setSelectedMachine(null); }}>
          <div className="drawer-content" style={{ width: '450px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Ficha Técnica del Equipo</h3>
              <button className="btn btn-secondary" onClick={() => { setIsDetailModalOpen(false); setSelectedMachine(null); }} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img
                  src={selectedMachine.photoUrl}
                  alt={selectedMachine.name}
                  style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }}
                />
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: '700' }}>{selectedMachine.name}</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Categoría: {selectedMachine.type}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Código ID</span>
                  <p style={{ fontWeight: '600', marginTop: '2px' }}>{selectedMachine.codigoId}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Estado Operativo</span>
                  <p style={{ marginTop: '2px' }}>{getStatusBadge(selectedMachine.status)}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Horas de Operación</span>
                  <p style={{ fontWeight: '600', marginTop: '2px' }}>{selectedMachine.hoursOfOperation.toLocaleString()} horas</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Consumo Promedio</span>
                  <p style={{ fontWeight: '600', marginTop: '2px' }}>{selectedMachine.fuelConsumption}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Costo Promedio / hora</span>
                  <p style={{ fontWeight: '600', marginTop: '2px', color: 'var(--primary)' }}>
                    ${(selectedMachine.costOperator + selectedMachine.costFuel + selectedMachine.costMaintenance + selectedMachine.costDepreciation).toLocaleString()} COP
                  </p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Próximo Mantenimiento</span>
                  <p style={{ fontWeight: '600', marginTop: '2px' }}>En {selectedMachine.nextMaintenanceHours} horas</p>
                </div>
              </div>

              <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '10px', marginTop: '8px' }}>
                <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Las calibraciones de maquinaria y sensores se programan por defecto en ciclos automáticos de 250 horas de labor continuas.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => { setIsDetailModalOpen(false); setSelectedMachine(null); }}>
                Cerrar Ficha
              </button>
              <button
                className="btn btn-primary"
                style={{ flexGrow: 1 }}
                onClick={() => {
                  const m = selectedMachine;
                  setIsDetailModalOpen(false);
                  handleOpenEditDrawer(m);
                }}
              >
                Editar Información
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
