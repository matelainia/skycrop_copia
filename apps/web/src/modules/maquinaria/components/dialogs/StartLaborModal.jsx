
import { X } from 'lucide-react';
import LaborForm from '../forms/LaborForm';

export const StartLaborModal = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  availableMachinery,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Iniciar Labor Agrícola</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="drawer-form">
          <LaborForm
            formData={formData}
            setFormData={setFormData}
            availableMachinery={availableMachinery}
          />

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            Iniciar y Registrar Labor
          </button>
        </form>
      </div>
    </div>
  );
};

export default StartLaborModal;
