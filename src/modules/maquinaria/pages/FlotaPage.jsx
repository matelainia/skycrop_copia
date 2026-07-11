
import { Plus, Play, BarChart3, Wrench } from 'lucide-react';
import FleetMetrics from '../components/dashboard/FleetMetrics';
import FleetFilters from '../components/dashboard/FleetFilters';
import FleetTable from '../components/dashboard/FleetTable';
import FleetPagination from '../components/dashboard/FleetPagination';
import ActiveOperationPanel from '../components/dashboard/ActiveOperationPanel';
import RecentActivity from '../components/dashboard/RecentActivity';
import UpcomingMaintenance from '../components/dashboard/UpcomingMaintenance';
import HoursChart from '../components/charts/HoursChart';
import DistributionChart from '../components/charts/DistributionChart';
import FuelChart from '../components/charts/FuelChart';
import FleetEfficiencyChart from '../components/charts/FleetEfficiencyChart';
import AddMachineDrawer from '../components/dialogs/AddMachineDrawer';
import EditMachineDrawer from '../components/dialogs/EditMachineDrawer';
import DetailDrawer from '../components/dialogs/DetailDrawer';
import StartLaborModal from '../components/dialogs/StartLaborModal';
import EndLaborModal from '../components/dialogs/EndLaborModal';
import MaintenanceModal from '../components/dialogs/MaintenanceModal';

export const FlotaPage = ({
  machineryHook,
  operationHook,
  maintenanceHook,
  setSubTab
}) => {
  const {
    metrics,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    filteredMachinery,
    paginatedMachinery,
    selectedMachine,
    setSelectedMachine,
    newMachine,
    setNewMachine,
    uploading,
    isAddMachineOpen,
    setIsAddMachineOpen,
    isEditMachineOpen,
    setIsEditMachineOpen,
    isDetailModalOpen,
    setIsDetailModalOpen,
    handleImageUpload,
    handleAddMachine,
    handleEditMachine,
    handleDeleteMachine
  } = machineryHook;

  const {
    activeMachineId,
    setActiveMachineId,
    activeMachine,
    activeJornada,
    isStartLaborOpen,
    setIsStartLaborOpen,
    isEndLaborOpen,
    setIsEndLaborOpen,
    laborForm,
    setLaborForm,
    endLaborForm,
    setEndLaborForm,
    handleStartLabor,
    handleEndLabor,
    openStartLaborForm,
    openEndLaborForm,
    getActiveJornadaForMachine
  } = operationHook;

  const {
    isMaintModalOpen,
    setIsMaintModalOpen,
    maintForm,
    setMaintForm,
    alerts,
    handleRegisterMaintenance,
    openMaintenanceForm
  } = maintenanceHook;

  return (
    <>
      {/* Section Header */}
      <div className="section-header">
        <div className="section-title-box">
          <h2>Flota de Maquinaria</h2>
          <p className="section-desc">Gestiona tu flota, operaciones y mantenimientos en tiempo real</p>
        </div>
        <div className="section-actions" style={{ gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setIsAddMachineOpen(true)}>
            <Plus size={16} />
            <span>Agregar Equipo</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => openStartLaborForm()}
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
            onClick={() => openMaintenanceForm()}
          >
            <Wrench size={16} />
            <span>Programar Mto.</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <FleetMetrics metrics={metrics} />

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.25fr', gap: '24px', alignItems: 'stretch' }} className="metrics-grid">
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <FleetFilters
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setCurrentPage={setCurrentPage}
              metrics={metrics}
            />

            <FleetTable
              paginatedMachinery={paginatedMachinery}
              activeMachineId={activeMachineId}
              setActiveMachineId={setActiveMachineId}
              getActiveJornadaForMachine={getActiveJornadaForMachine}
              onStartLabor={openStartLaborForm}
              onEndLabor={openEndLaborForm}
              onViewDetails={(m) => {
                setSelectedMachine(m);
                setIsDetailModalOpen(true);
              }}
              onEdit={(m) => {
                setSelectedMachine(m);
                setIsEditMachineOpen(true);
              }}
              onDelete={handleDeleteMachine}
            />

            <FleetPagination
              filteredCount={filteredMachinery.length}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              rowsPerPage={rowsPerPage}
            />
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ActiveOperationPanel
            activeMachine={activeMachine}
            activeJornada={activeJornada}
            onStartLabor={openStartLaborForm}
            onEndLabor={openEndLaborForm}
          />

          <RecentActivity
            jornadas={operationHook.jornadas}
            onViewAll={() => setSubTab('operaciones')}
          />

          <UpcomingMaintenance
            alerts={alerts}
            onViewAll={() => setSubTab('mantenimientos')}
          />
        </div>

      </div>

      {/* SVG Charts Grid */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <HoursChart />
        <DistributionChart />
        <FuelChart />
        <FleetEfficiencyChart />
      </div>

      {/* Dialogs and Modals */}
      <AddMachineDrawer
        isOpen={isAddMachineOpen}
        onClose={() => setIsAddMachineOpen(false)}
        formData={newMachine}
        setFormData={setNewMachine}
        onImageUpload={handleImageUpload}
        uploading={uploading}
        onSubmit={handleAddMachine}
      />

      <EditMachineDrawer
        isOpen={isEditMachineOpen}
        onClose={() => {
          setIsEditMachineOpen(false);
          setSelectedMachine(null);
        }}
        formData={selectedMachine}
        setFormData={setSelectedMachine}
        onImageUpload={handleImageUpload}
        uploading={uploading}
        onSubmit={handleEditMachine}
      />

      <DetailDrawer
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedMachine(null);
        }}
        machine={selectedMachine}
        onEdit={(m) => {
          setSelectedMachine(m);
          setIsEditMachineOpen(true);
        }}
      />

      <StartLaborModal
        isOpen={isStartLaborOpen}
        onClose={() => setIsStartLaborOpen(false)}
        formData={laborForm}
        setFormData={setLaborForm}
        availableMachinery={machineryHook.machinery.filter(m => m.status === 'Disponible')}
        onSubmit={handleStartLabor}
      />

      <EndLaborModal
        isOpen={isEndLaborOpen}
        onClose={() => setIsEndLaborOpen(false)}
        formData={endLaborForm}
        setFormData={setEndLaborForm}
        onSubmit={handleEndLabor}
      />

      <MaintenanceModal
        isOpen={isMaintModalOpen}
        onClose={() => setIsMaintModalOpen(false)}
        formData={maintForm}
        setFormData={setMaintForm}
        machineryList={machineryHook.machinery}
        onSubmit={handleRegisterMaintenance}
      />
    </>
  );
};

export default FlotaPage;
