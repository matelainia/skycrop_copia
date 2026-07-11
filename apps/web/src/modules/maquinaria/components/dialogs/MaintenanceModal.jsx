
import { X } from 'lucide-react';
import MaintenanceForm from '../forms/MaintenanceForm';

export const MaintenanceModal = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  machineryList,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Registrar Mantenimiento</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="drawer-form">
          <MaintenanceForm
            formData={formData}
            setFormData={setFormData}
            machineryList={machineryList}
          />

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            Habilitar y Programar Próximo Ciclo (+250 h)
          </button>
        </form>
      </div>
    </div>
  );
};

export default MaintenanceModal;
