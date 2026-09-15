import { useState, useMemo, useCallback } from 'react';
import { useMachineryContext } from '../context/MachineryProvider';
import { MACHINERY_STATUS, isMachineStatus } from '../constants/machineryStatus';
import { machineryService } from '../services/machinery.service';
import { machineryStorage } from '../storage/machinery.storage';
import { calculateFuelBurnToday, calculateHoursWorkedToday } from '../utils/calculations';

export const useMachinery = () => {
  const { machinery, loading, refreshData } = useMachineryContext();
  
  // Filter States
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Selected Machine for Detail/Edit Forms
  const [selectedMachine, setSelectedMachine] = useState(null);
  
  // Modal Flags
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [isEditMachineOpen, setIsEditMachineOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State for addition
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

  // Upload image to Supabase storage bucket
  const handleImageUpload = useCallback(async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await machineryStorage.uploadPhoto(file);

      if (isEdit) {
        setSelectedMachine(prev => ({ ...prev, photoUrl: publicUrl }));
      } else {
        setNewMachine(prev => ({ ...prev, photoUrl: publicUrl }));
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Error al subir imagen. Revisa los logs o el bucket de Supabase. Detalle: ' + error.message);
    } finally {
      setUploading(false);
    }
  }, []);

  // CRUD actions
  const handleAddMachine = useCallback(async (e) => {
    e.preventDefault();
    const nextM = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const payload = {
      ...newMachine,
      lastMaintenance: new Date().toISOString().split('T')[0],
      nextMaintenance: nextM
    };

    try {
      await machineryService.registerMachine(payload, machinery);
      setIsAddMachineOpen(false);
      // Reset form
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
      alert(err.message);
    }
  }, [newMachine, machinery]);

  const handleEditMachine = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedMachine) return;

    try {
      await machineryService.updateMachine(selectedMachine.id, selectedMachine, machinery);
      setIsEditMachineOpen(false);
      setSelectedMachine(null);
    } catch (err) {
      alert(err.message);
    }
  }, [selectedMachine, machinery]);

  const handleDeleteMachine = useCallback(async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta máquina del SaaS? Se perderán sus historiales de labores.')) return;
    
    const target = machinery.find(m => m.id === id);
    try {
      await machineryService.removeMachine(id, target);
    } catch (err) {
      alert(err.message);
    }
  }, [machinery]);

  const handleUpdateRates = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedMachine) return;
    try {
      await machineryService.updateMachine(selectedMachine.id, selectedMachine, machinery);
      alert(`Tarifas de costos actualizadas para ${selectedMachine.codigoId}`);
      setSelectedMachine(null);
    } catch (err) {
      alert(err.message);
    }
  }, [selectedMachine, machinery]);

  // Filtering list
  const filteredMachinery = useMemo(() => {
    return machinery.filter(m => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.codigoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.type.toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === 'Todos') return matchesSearch;
      // H-04: comparar por valor canónico (las instancias ya salen normalizadas
      // de Machine.fromDatabase; isMachineStatus tolera alias legacy).
      if (statusFilter === 'Disponibles') return matchesSearch && isMachineStatus(m.status, MACHINERY_STATUS.DISPONIBLE);
      if (statusFilter === 'Operando') return matchesSearch && isMachineStatus(m.status, MACHINERY_STATUS.OPERANDO);
      if (statusFilter === 'En Mantenimiento') return matchesSearch && isMachineStatus(m.status, MACHINERY_STATUS.MANTENIMIENTO);
      if (statusFilter === 'Fuera de Servicio') return matchesSearch && isMachineStatus(m.status, MACHINERY_STATUS.FUERA_DE_SERVICIO);
      return matchesSearch;
    });
  }, [machinery, searchQuery, statusFilter]);

  // Pagination list
  const paginatedMachinery = useMemo(() => {
    return filteredMachinery.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
  }, [filteredMachinery, currentPage]);

  // Memoized Metrics Calculations
  const metrics = useMemo(() => {
    const totalCount = machinery.length;
    const operatingCount = machinery.filter(m => isMachineStatus(m.status, MACHINERY_STATUS.OPERANDO)).length;
    const maintenanceCount = machinery.filter(m => isMachineStatus(m.status, MACHINERY_STATUS.MANTENIMIENTO)).length;
    const criticalCount = machinery.filter(m => isMachineStatus(m.status, MACHINERY_STATUS.FUERA_DE_SERVICIO)).length;
    const availableCount = machinery.filter(m => isMachineStatus(m.status, MACHINERY_STATUS.DISPONIBLE)).length;

    const totalHoursWorkedToday = calculateHoursWorkedToday(machinery);
    const totalFuelConsumedToday = calculateFuelBurnToday(machinery);

    return {
      totalCount,
      operatingCount,
      maintenanceCount,
      criticalCount,
      availableCount,
      totalHoursWorkedToday,
      totalFuelConsumedToday
    };
  }, [machinery]);

  return {
    machinery,
    loading,
    refreshData,
    metrics,
    
    // Filters & Pagination
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    filteredMachinery,
    paginatedMachinery,
    
    // Dialog and CRUD handlers
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
    handleDeleteMachine,
    handleUpdateRates
  };
};
export default useMachinery;
