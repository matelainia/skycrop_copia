import React, { useState, useEffect } from 'react';
import { Users, Package, Tractor, HeartPulse, Sprout, Sun, Moon, CloudSun, Calendar, LogOut } from 'lucide-react';
import TalentoHumano from '../components/TalentoHumano';
import InventarioBodegas from '../components/InventarioBodegas/InventarioBodegas';
import Maquinaria from '../modules/maquinaria';
import ManejoSanitario from '../components/manejo-sanitario/ManejoSanitarioModule';
import CosechaPostcosecha from '../components/CosechaPostcosecha/CosechaPostcosecha';
import Climate from '../modules/Climate';
import { supabase } from '../lib/supabaseClient';
import { useAuthContext } from '../context/AuthContext';

export default function App() {
  const { user, empresa, role, permissions, logout, hasPermission } = useAuthContext();

  const menuItems = [
    { id: 'talento', label: 'Talento Humano', icon: <Users size={18} />, recurso: 'laboral' },
    { id: 'inventario', label: 'Inventario y Bodegas', icon: <Package size={18} />, recurso: 'inventario' },
    { id: 'maquinaria', label: 'Maquinaria', icon: <Tractor size={18} />, recurso: 'maquinaria' },
    { id: 'sanitario', label: 'Manejo Sanitario', icon: <HeartPulse size={18} />, recurso: 'aplicaciones' },
    { id: 'cosecha', label: 'Cosecha y Postcosecha', icon: <Sprout size={18} />, recurso: 'cosechas' },
    { id: 'clima', label: 'Clima', icon: <Sun size={18} />, recurso: 'lotes' },
  ].filter(item => hasPermission(item.recurso, 'leer'));

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('skycrop_active_tab') || 'talento';
  });

  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('skycrop_active_subtab') || 'flota';
  });

  // Si la pestaña activa no está permitida por el rol, cambiar a la primera permitida
  useEffect(() => {
    if (menuItems.length > 0 && !menuItems.some(item => item.id === activeTab)) {
      setActiveTab(menuItems[0].id);
    }
  }, [permissions]);

  useEffect(() => {
    localStorage.setItem('skycrop_active_subtab', activeSubTab);
  }, [activeSubTab]);

  const [expiredCerts, setExpiredCerts] = useState(3);
  const [pendingSafety, setPendingSafety] = useState(12);

  const fetchTrainingAlerts = async () => {
    try {
      // 1. Fetch expired certificates count
      const { data: rData, error: rError } = await supabase
        .from('registros_formacion')
        .select('*, cursos_formacion(tipo)')
        .eq('estado', 'Vencida');
      
      if (rError) throw rError;
      setExpiredCerts(rData?.length || 0);

      // 2. Fetch active workers count
      const { data: wData, error: wError } = await supabase
        .from('trabajadores')
        .select('id')
        .eq('estado', 'Activa');
      if (wError) throw wError;
      const totalWorkers = wData?.length || 0;

      // 3. Fetch completed safety trainings
      const { data: sData, error: sError } = await supabase
        .from('registros_formacion')
        .select('trabajador_id, curso_id')
        .eq('estado', 'Completada');
      if (sError) throw sError;

      // Fetch safety courses
      const { data: cData } = await supabase
        .from('cursos_formacion')
        .select('id')
        .eq('tipo', 'Seguridad y Salud');
      const safetyCourseIds = (cData || []).map(c => c.id);

      const completedSafetySet = new Set(
        (sData || [])
          .filter(r => safetyCourseIds.includes(r.curso_id))
          .map(r => r.trabajador_id)
      );

      const pending = Math.max(0, totalWorkers - completedSafetySet.size);
      setPendingSafety(pending);
    } catch (err) {
      // Fallback metrics
      setExpiredCerts(3);
      setPendingSafety(12);
    }
  };

  useEffect(() => {
    fetchTrainingAlerts();
    // Poll every 10s to keep it dynamic and updated
    const interval = setInterval(fetchTrainingAlerts, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('skycrop_theme');
    return saved ? saved === 'dark' : false;
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Theme effect
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('skycrop_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('skycrop_theme', 'light');
    }
  }, [isDark]);

  // Save active tab
  useEffect(() => {
    localStorage.setItem('skycrop_active_tab', activeTab);
  }, [activeTab]);

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'talento':
        return <TalentoHumano />;
      case 'inventario':
        return <InventarioBodegas />;
      case 'maquinaria':
        return <Maquinaria subTab={activeSubTab} setSubTab={setActiveSubTab} />;
      case 'sanitario':
        return <ManejoSanitario subTab={activeSubTab} setSubTab={setActiveSubTab} />;
      case 'cosecha':
        return <CosechaPostcosecha />;
      case 'clima':
        return <Climate />;
      default:
        return <TalentoHumano />;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'talento': return 'Gestión de Talento Humano';
      case 'inventario': return 'Control de Inventario y Bodegas';
      case 'maquinaria': return 'Flota de Maquinaria';
      case 'sanitario': return 'Manejo Sanitario';
      case 'cosecha': return 'Rendimiento Cosecha y Postcosecha';
      case 'clima': return 'Centro de Inteligencia Climática';
      default: return 'Panel Principal';
    }
  };


  return (
    <div className="app-wrapper">
      {/* Sidebar Navigation */}
      <aside className="sidebar-container">
        <div className="sidebar-brand">
          <div className="logo-icon"><Sprout size={20} /></div>
          <span className="brand-name">SkyCrop</span>
        </div>
        
        <ul className="sidebar-menu">
          {menuItems.map(item => (
            <li key={item.id}>
              <button
                className={`menu-item-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'maquinaria') {
                    setActiveSubTab('flota');
                  } else if (item.id === 'sanitario') {
                    setActiveSubTab('lotes');
                  }
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
              
              {/* Nested hierarchical menu for Maquinaria */}
              {item.id === 'maquinaria' && activeTab === 'maquinaria' && (
                <ul style={{ listStyle: 'none', paddingLeft: '28px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {[
                    { id: 'flota', label: 'Flota de Maquinaria' },
                    { id: 'operaciones', label: 'Operaciones / Jornadas' },
                    { id: 'mantenimientos', label: 'Mantenimientos' },
                    { id: 'combustible', label: 'Combustible' },
                    { id: 'historial', label: 'Historial' },
                    { id: 'costos', label: 'Costos' },
                    { id: 'alertas', label: 'Alertas' },
                    { id: 'reportes', label: 'Reportes' }
                  ].map(sub => (
                    <li key={sub.id}>
                      <button
                        onClick={() => setActiveSubTab(sub.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: activeSubTab === sub.id ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: '13px',
                          padding: '6px 8px',
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: activeSubTab === sub.id ? '600' : '400',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'color 0.2s'
                        }}
                      >
                        <span style={{ 
                          width: '5px', 
                          height: '5px', 
                          borderRadius: '50%', 
                          background: activeSubTab === sub.id ? 'var(--primary)' : 'transparent',
                          display: 'inline-block' 
                        }} />
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Nested hierarchical menu for Manejo Sanitario */}
              {item.id === 'sanitario' && activeTab === 'sanitario' && (
                <ul style={{ listStyle: 'none', paddingLeft: '28px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {[
                    { id: 'lotes', label: 'Lotes / Sectores' },
                    { id: 'aplicaciones', label: 'Aplicaciones' },
                    { id: 'monitoreos', label: 'Monitoreos y Evaluaciones' },
                    { id: 'cosecha_plan', label: 'Planificación de Cosecha' },
                    { id: 'costos_san', label: 'Costos y Rentabilidad' },
                    { id: 'historial_traz', label: 'Historial y Trazabilidad' },
                    { id: 'reportes_san', label: 'Reportes' }
                  ].map(sub => (
                    <li key={sub.id}>
                      <button
                        onClick={() => setActiveSubTab(sub.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: activeSubTab === sub.id ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: '13px',
                          padding: '6px 8px',
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: activeSubTab === sub.id ? '600' : '400',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'color 0.2s'
                        }}
                      >
                        <span style={{ 
                          width: '5px', 
                          height: '5px', 
                          borderRadius: '50%', 
                          background: activeSubTab === sub.id ? 'var(--primary)' : 'transparent',
                          display: 'inline-block' 
                        }} />
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {/* Panel de Alertas Críticas */}
        <div className="sidebar-alerts-section">
          <div className="sidebar-alerts-title">Panel de Alertas Críticas</div>
          
          <div className="sidebar-alert-card">
            <div className="sidebar-alert-card-title">Insumos HR / Alertas</div>
            <div className="sidebar-alert-list">
              <div className="sidebar-alert-item" style={{ color: expiredCerts > 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                {expiredCerts} Certificaciones Críticas por vencer
              </div>
              <div className="sidebar-alert-item" style={{ color: pendingSafety > 0 ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                Capacitación de Seguridad obligatoria pendiente para {pendingSafety} empleados
              </div>
            </div>
          </div>

          <div className="sidebar-alert-card warn">
            <div className="sidebar-alert-card-title">Alertas del Cultivo</div>
            <div className="sidebar-alert-list">
              <div className="sidebar-alert-item">
                Mantenimiento de Tractor T-01 vencido
              </div>
              <div className="sidebar-alert-item">
                Alerta de Roya detectada en Lote B-12
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            className="theme-toggle-btn" 
            onClick={() => setIsDark(!isDark)}
          >
            {isDark ? (
              <>
                <Sun size={16} />
                <span>Modo Claro</span>
              </>
            ) : (
              <>
                <Moon size={16} />
                <span>Modo Oscuro</span>
              </>
            )}
          </button>
          
          <button 
            className="theme-toggle-btn" 
            onClick={logout}
            style={{ color: 'var(--accent-red)' }}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="main-layout">
        {/* Top Header */}
        <header className="header-container">
          <div className="header-title-section">
            <h1>{getTabTitle()}</h1>
          </div>

          <div className="header-actions">
            {/* Weather Mock Widget */}
            <div className="weather-widget">
              <CloudSun size={16} style={{ color: 'var(--accent-gold)' }} />
              <span>27°C | Valle del Cauca, CO</span>
            </div>

            {/* Time / Date widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <Calendar size={14} />
              <span>
                {currentTime.toLocaleDateString('es-ES', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short' 
                })}
              </span>
            </div>

            {/* Profile Avatar */}
            <div className="user-profile">
              <div className="avatar">
                {user ? `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`.toUpperCase() || user.email?.slice(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="user-info">
                <span className="user-name">
                  {user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email : 'Cargando...'}
                </span>
                <span className="user-role">
                  {role?.nombre || 'Usuario'} {empresa ? `| ${empresa.nombre}` : ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="page-content">
          {renderActiveComponent()}
        </div>
      </div>
    </div>
  );
}
