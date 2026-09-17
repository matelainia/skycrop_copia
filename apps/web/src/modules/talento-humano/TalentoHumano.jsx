import React, { useState, lazy, Suspense } from 'react';
import { UserCheck, ClipboardList, CalendarDays, GraduationCap, DollarSign } from 'lucide-react';

// Load Styles
import './styles/common.css';
import './styles/gestion.css';
import './styles/cuadrillas.css';
import './styles/labores.css';
import './styles/formacion.css';
import './styles/nominas.css';

// Lazy Load Coordinators
const GestionPersonal = lazy(() => import('./gestion/GestionPersonal'));
const Cuadrillas = lazy(() => import('./cuadrillas/Cuadrillas'));
const Labores = lazy(() => import('./labores/Labores'));
const Formacion = lazy(() => import('./formacion/Formacion'));
const Nominas = lazy(() => import('./nominas/Nominas'));

const SUB_TABS = [
  { id: 'gestion',   label: 'Gestión de Personal',      icon: <UserCheck   size={15} /> },
  { id: 'asistencia',label: 'Asistencia y Cuadrillas',  icon: <ClipboardList size={15} /> },
  { id: 'labores',   label: 'Labores del Día',           icon: <CalendarDays  size={15} /> },
  { id: 'formacion', label: 'Formación y Capacitación',  icon: <GraduationCap size={15} /> },
  { id: 'nominas',   label: 'Nóminas y Pagos',           icon: <DollarSign    size={15} /> },
];

export default function TalentoHumano() {
  const [activeTab, setActiveTab] = useState('gestion');

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'gestion':
        return <GestionPersonal />;
      case 'asistencia':
        return <Cuadrillas />;
      case 'labores':
        return <Labores />;
      case 'formacion':
        return <Formacion />;
      case 'nominas':
        return <Nominas />;
      default:
        return <GestionPersonal />;
    }
  };

  return (
    <div className="p-6" style={{ background: 'var(--bg-app)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>
            Talento Humano & Personal
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Gestión centralizada de operarios, cuadrillas de campo, labores del día, certificaciones y nóminas de pago.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, overflowX: 'auto' }}>
        {SUB_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id}
              className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab(tab.id)}>
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Suspense fallback={<div style={{ textAlign: 'center', padding: 48, fontSize: 14, color: 'var(--text-muted)' }}>Cargando submódulo...</div>}>
        {renderActiveTabContent()}
      </Suspense>
    </div>
  );
}
