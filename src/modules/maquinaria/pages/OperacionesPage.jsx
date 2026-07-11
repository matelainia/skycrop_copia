
import { Plus } from 'lucide-react';
import OperationsTable from '../components/tables/OperationsTable';
import StartLaborModal from '../components/dialogs/StartLaborModal';

export const OperacionesPage = ({
  machineryHook,
  operationHook
}) => {
  const {
    jornadas,
    isStartLaborOpen,
    setIsStartLaborOpen,
    laborForm,
    setLaborForm,
    handleStartLabor,
    openStartLaborForm
  } = operationHook;

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Historial de Operaciones / Jornadas de Trabajo</h3>
        <button
          className="btn btn-primary"
          onClick={() => openStartLaborForm()}
        >
          <Plus size={16} />
          Iniciar Nueva Jornada
        </button>
      </div>

      <OperationsTable jornadas={jornadas} />

      <StartLaborModal
        isOpen={isStartLaborOpen}
        onClose={() => setIsStartLaborOpen(false)}
        formData={laborForm}
        setFormData={setLaborForm}
        availableMachinery={machineryHook.machinery.filter(m => m.status === 'Disponible')}
        onSubmit={handleStartLabor}
      />
    </div>
  );
};

export default OperacionesPage;
