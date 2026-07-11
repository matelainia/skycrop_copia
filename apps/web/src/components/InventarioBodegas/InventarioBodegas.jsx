import React, { useState, useEffect } from 'react';
import { Plus, Layers } from 'lucide-react';
import { InventoryModuleProvider } from './context/InventoryModuleContext';
import { useInventory } from './hooks/useInventory';
import { useInventoryMutations } from './hooks/useInventoryMutations';
import { useWarehouses } from './hooks/useWarehouses';
import { useWarehouseMutations } from './hooks/useWarehouseMutations';
import { useInventoryMovements } from './hooks/useInventoryMovements';
import { useInventoryFilters } from './hooks/useInventoryFilters';
import { usePagination } from './hooks/usePagination';
import { calculateMetrics, getWarehouseStats } from './utils/inventoryCalculations';
import { ITEMS_PER_PAGE } from './utils/inventoryConstants';

// Component imports
import InventoryMetrics from './components/Inventory/InventoryMetrics';
import WarehouseCards from './components/Warehouse/WarehouseCards';
import InventoryToolbar from './components/Inventory/InventoryToolbar';
import InventoryTable from './components/Inventory/InventoryTable';
import InventoryPagination from './components/Inventory/InventoryPagination';
import AddItemDrawer from './components/Inventory/AddItemDrawer';
import ManageWarehousesDrawer from './components/Warehouse/ManageWarehousesDrawer';
import ViewItemModal from './components/Inventory/ViewItemModal';
import AdjustStockModal from './components/Inventory/AdjustStockModal';
import ToastNotification from './components/Shared/ToastNotification';

function InventarioBodegasContent() {
  const { items, refresh: refreshInventory } = useInventory();
  const { warehouses, workers, refresh: refreshWarehouses } = useWarehouses();

  const { createItem, deleteItem, adjustStock } = useInventoryMutations(refreshInventory);
  const { createWarehouse, deleteWarehouse } = useWarehouseMutations(refreshWarehouses);
  const { movements, loading: movementsLoading, getMovements } = useInventoryMovements();

  // Control states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isManageWarehousesOpen, setIsManageWarehousesOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Filters hook
  const {
    activeWarehouse,
    setActiveWarehouse,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    filteredItems
  } = useInventoryFilters(items);

  // Pagination hook
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems
  } = usePagination(filteredItems, ITEMS_PER_PAGE, [search, categoryFilter, activeWarehouse]);

  // Load movements when selected item is opened for viewing
  useEffect(() => {
    if (isViewOpen && selectedItem) {
      getMovements(selectedItem.id);
    }
  }, [isViewOpen, selectedItem, getMovements]);

  // Derived metrics and stats
  const metrics = calculateMetrics(items, warehouses);
  const warehouseStats = getWarehouseStats(items, warehouses);

  return (
    <>
      <ToastNotification />

      <div className="section-header">
        <div className="section-title-box">
          <h2>Inventario y Bodegas</h2>
          <p className="section-desc">Control de insumos, herramientas, semillas y agroquímicos por bodega</p>
        </div>
        <div className="section-actions">
          <button className="btn btn-secondary" onClick={() => setIsManageWarehousesOpen(true)}>
            <Layers size={18} />
            <span>Gestionar Bodegas</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsDrawerOpen(true)}>
            <Plus size={18} />
            <span>Agregar Insumo</span>
          </button>
        </div>
      </div>

      {/* Metrics Section */}
      <InventoryMetrics
        totalItemsCount={metrics.totalItemsCount}
        lowStockCount={metrics.lowStockCount}
        warehousesCount={metrics.warehousesCount}
        occupancyPercentage={metrics.occupancyPercentage}
      />

      {/* Warehouse Selection Cards */}
      <WarehouseCards
        warehouseStats={warehouseStats}
        activeWarehouse={activeWarehouse}
        onSelectWarehouse={setActiveWarehouse}
        workers={workers}
      />

      {/* Main Catalog Table & Search / Toolbar */}
      <div className="glass-card">
        <InventoryToolbar
          search={search}
          setSearch={setSearch}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />

        <InventoryTable
          items={paginatedItems}
          warehouses={warehouses}
          onViewItem={(item) => {
            setSelectedItem(item);
            setIsViewOpen(true);
          }}
          onAdjustStock={(item) => {
            setSelectedItem(item);
            setIsAdjustOpen(true);
          }}
          onDeleteItem={deleteItem}
        />

        <InventoryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={filteredItems.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Item Drawer */}
      <AddItemDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        warehouses={warehouses}
        onAddItem={createItem}
      />

      {/* Manage Warehouses Drawer */}
      <ManageWarehousesDrawer
        isOpen={isManageWarehousesOpen}
        onClose={() => setIsManageWarehousesOpen(false)}
        warehouses={warehouses}
        workers={workers}
        onCreateWarehouse={createWarehouse}
        onDeleteWarehouse={deleteWarehouse}
      />

      {/* View Item Details Modal */}
      <ViewItemModal
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        warehouseName={warehouses.find(w => w.id === selectedItem?.warehouseId)?.nombre || "Sin asignar"}
        movements={movements}
        movementsLoading={movementsLoading}
      />

      {/* Adjust Stock Modal */}
      <AdjustStockModal
        isOpen={isAdjustOpen}
        onClose={() => {
          setIsAdjustOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onAdjust={adjustStock}
      />
    </>
  );
}

export default function InventarioBodegas() {
  return (
    <InventoryModuleProvider>
      <InventarioBodegasContent />
    </InventoryModuleProvider>
  );
}
