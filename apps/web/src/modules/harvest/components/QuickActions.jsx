import React from 'react';
import { Plus, Sprout, Warehouse, Truck, Users, BarChart3 } from 'lucide-react';

export function QuickActions({ onRegistrarCosecha, onRegistrarPostcosecha, onAlmacenamiento, onDespacho, onClientes, onReportes }) {
  return (
    <div className="white-card">
      <h3>Acciones Rápidas</h3>
      <div className="quick-grid">
        <button className="quick-btn" onClick={onRegistrarCosecha}>
          <div className="quick-icon green"><Plus size={18}/></div>
          <span className="quick-label">Registrar Cosecha</span>
        </button>
        <button className="quick-btn" onClick={onRegistrarPostcosecha}>
          <div className="quick-icon lightgreen"><Sprout size={18}/></div>
          <span className="quick-label">Registrar Postcosecha</span>
        </button>
        <button className="quick-btn" onClick={onAlmacenamiento}>
          <div className="quick-icon blue"><Warehouse size={18}/></div>
          <span className="quick-label">Registrar Almacenamiento</span>
        </button>
        <button className="quick-btn" onClick={onDespacho}>
          <div className="quick-icon teal"><Truck size={18}/></div>
          <span className="quick-label">Registrar Despacho</span>
        </button>
        <button className="quick-btn" onClick={onClientes}>
          <div className="quick-icon violet"><Users size={18}/></div>
          <span className="quick-label">Gestionar Clientes</span>
        </button>
        <button className="quick-btn" onClick={onReportes}>
          <div className="quick-icon" style={{background:'#f3f4f6', color:'#6b7280'}}><BarChart3 size={18}/></div>
          <span className="quick-label">Ver Reportes</span>
        </button>
      </div>
    </div>
  );
}
export default QuickActions;
