
import { X } from 'lucide-react';
import MachineForm from '../forms/MachineForm';

export const EditMachineDrawer = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onImageUpload,
  uploading,
  onSubmit
}) => {
  if (!isOpen || !formData) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Editar Información de Maquinaria</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form className="drawer-form" onSubmit={onSubmit}>
          <MachineForm
            formData={formData}
            setFormData={setFormData}
            onImageUpload={onImageUpload}
            uploading={uploading}
            isEdit={true}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMachineDrawer;
