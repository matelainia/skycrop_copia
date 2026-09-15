import { Plus, Wrench, BarChart3, Tractor } from 'lucide-react';

/**
 * MachineryHeader — cabecera persistente del módulo Maquinaria.
 * No navega fuera del módulo: las acciones primarias abren drawers/modales
 * o cambian la pestaña activa.
 */
export function MachineryHeader({ onRegister, onGoMaintenance, onGoReports, canCreate = true }) {
  return (
    <div className="machinery-header">
      <div className="machinery-header-title">
        <div className="machinery-header-icon" aria-hidden="true">
          <Tractor size={22} />
        </div>
        <div>
          <h2 className="machinery-header-h">Maquinaria</h2>
          <p className="machinery-header-sub">Gestión integral de la flota y sus operaciones</p>
        </div>
      </div>

      <div className="machinery-header-actions">
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={onRegister}>
            <Plus size={16} aria-hidden="true" />
            <span>Registrar maquinaria</span>
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onGoMaintenance}>
          <Wrench size={16} aria-hidden="true" />
          <span>Ver mantenimiento</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onGoReports}>
          <BarChart3 size={16} aria-hidden="true" />
          <span>Reportes</span>
        </button>
      </div>
    </div>
  );
}

export default MachineryHeader;
