import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Layers } from 'lucide-react';
import { InventoryModuleProvider, useInventoryModule } from './context/InventoryModuleContext';
import { useInventory } from './hooks/useInventory';
import { useInventoryMutations } from './hooks/useInventoryMutations';
import { useWarehouses } from './hooks/useWarehouses';
import { useWarehouseMutations } from './hooks/useWarehouseMutations';
import { useInventoryMovements } from './hooks/useInventoryMovements';
import { useInventoryFilters } from './hooks/useInventoryFilters';
import { useInventoryPermissions } from './hooks/useInventoryPermissions';
import { usePagination } from './hooks/usePagination';
import { useUrlFilters } from './hooks/useUrlFilters';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { calculateMetrics, getWarehouseStats } from './utils/inventoryCalculations';
import { getStockStatus, getStatusMeta } from './utils/inventoryStatus';
import { ITEMS_PER_PAGE } from './utils/inventoryConstants';
import { exportInventoryCsv } from './utils/exportCsv';

// Component imports
import InventoryMetrics from './components/Inventory/InventoryMetrics';
import WarehouseCards from './components/Warehouse/WarehouseCards';
import WarehousesTab from './components/Warehouse/WarehousesTab';
import InventoryToolbar from './components/Inventory/InventoryToolbar';
import InventoryTable from './components/Inventory/InventoryTable';
import InventoryPagination from './components/Inventory/InventoryPagination';
import ItemModal from './components/Inventory/ItemModal';
import ManageWarehousesDrawer from './components/Warehouse/ManageWarehousesDrawer';
import ViewItemModal from './components/Inventory/ViewItemModal';
import MovementModal from './components/Inventory/MovementModal';
import MovementsFeed from './components/Movements/MovementsFeed';
import ToastNotification from './components/Shared/ToastNotification';
import StockAlertsBell from './components/Shared/StockAlertsBell';
import WorkspaceTabs from './components/Shared/WorkspaceTabs';
import ConfirmDialog from './components/Shared/ConfirmDialog';

function InventarioBodegasContent() {
  const { showSuccess } = useInventoryModule();
  const perms = useInventoryPermissions();

  // Filtros persistidos en URL (contrato §5).
  const [url, setUrl] = useUrlFilters();
  const debouncedSearch = useDebouncedValue(url.q, 300);

  const { items, refresh: refreshInventory } = useInventory({
    search: debouncedSearch,
    sortKey: url.sort,
    sortDir: Number(url.dir),
  });
  const { warehouses, workers, refresh: refreshWarehouses } = useWarehouses();

  const { createItem, updateItem, deleteItem, adjustStock, transferStock } = useInventoryMutations(refreshInventory);
  const { createWarehouse, deleteWarehouse } = useWarehouseMutations(() => {
    refreshWarehouses();
    refreshInventory();
  });
  const { movements, loading: movementsLoading, getMovements } = useInventoryMovements();

  // Control states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isManageWarehousesOpen, setIsManageWarehousesOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // {kind:'item'|'warehouse', id, name}
  const [allMovements, setAllMovements] = useState([]);

  // Filtros cliente (búsqueda y orden son server-side).
  const {
    activeWarehouse,
    setActiveWarehouse,
    categoryFilter,
    setCategoryFilter,
    filteredItems
  } = useInventoryFilters(items, url.st, { wh: url.wh, cat: url.cat });

  // Sincronizar cambios de filtro hacia la URL (una sola dirección para
  // evitar bucles: la URL manda al montar, los controles mandan después).
  const syncUrl = (patch) => setUrl(patch);

  // Pagination hook (page inicial desde URL).
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems
  } = usePagination(filteredItems, ITEMS_PER_PAGE, [debouncedSearch, categoryFilter, activeWarehouse, url.st]);

  useEffect(() => {
    const p = Number(url.page);
    if (p >= 1) setCurrentPage(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Movimientos: del ítem en vista, o globales en tab Movimientos.
  useEffect(() => {
    if (isViewOpen && selectedItem) {
      getMovements(selectedItem.id);
    }
  }, [isViewOpen, selectedItem, getMovements]);

  useEffect(() => {
    if (url.tab === 'movs') {
      getMovements(null).then((data) => {
        if (data) setAllMovements(data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url.tab, items]);

  // Derived metrics and stats
  const metrics = calculateMetrics(items, warehouses);
  const warehouseStats = getWarehouseStats(items, warehouses);
  const warehouseNameOf = (id) => warehouses.find((w) => w.id === id)?.nombre || 'Sin asignar';
  const itemNameOf = (id) => items.find((i) => i.id === id)?.name || 'Artículo';

  const hasActiveFilters = url.q !== '' || url.cat !== 'Todos' || url.wh !== 'all' || url.st !== 'todos';
  const clearFilters = () => {
    setUrl({ q: '', cat: 'Todos', wh: 'all', st: 'todos' });
    setActiveWarehouse('all');
    setCategoryFilter('Todos');
  };

  const handleExport = () => {
    exportInventoryCsv(
      filteredItems,
      warehouseNameOf,
      (it) => getStatusMeta(getStockStatus(it)).label
    );
    showSuccess(`Exportación lista: ${filteredItems.length} artículos a CSV.`);
  };

  const handleSaveItem = (form, id) => (id ? updateItem(id, form) : createItem(form));

  const tabCounts = useMemo(() => ({
    insumos: items.length,
    bodegas: warehouses.length,
    movs: allMovements.length || movements.length
  }), [items.length, warehouses.length, allMovements.length, movements.length]);

  return (
    <>
      <ToastNotification />

      <div className="section-header">
        <div className="section-title-box">
          <h2>Inventario y Bodegas</h2>
          <p className="section-desc">Control de insumos, herramientas, semillas y agroquímicos por bodega</p>
        </div>
        <div className="section-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StockAlertsBell items={items} onFilterAlerts={() => setUrl({ st: 'alertas', tab: 'insumos' })} />
          {perms.canManageWarehouses && (
            <button className="btn btn-secondary" onClick={() => setIsManageWarehousesOpen(true)}>
              <Layers size={18} />
              <span>Gestionar Bodegas</span>
            </button>
          )}
          {perms.canCreate && (
            <button className="btn btn-primary" onClick={() => { setEditingItem(null); setIsItemModalOpen(true); }}>
              <Plus size={18} />
              <span>Agregar Insumo</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      <InventoryMetrics
        totalItemsCount={metrics.totalItemsCount}
        lowStockCount={metrics.lowStockCount}
        warehousesCount={metrics.warehousesCount}
        occupancyPercentage={metrics.occupancyPercentage}
        occupancyLabel={metrics.occupancyLabel}
        onShowAlerts={() => syncUrl({ st: 'alertas' })}
        onShowAll={clearFilters}
      />

      {/* Warehouse Selection Cards */}
      <WarehouseCards
        warehouseStats={warehouseStats}
        activeWarehouse={activeWarehouse}
        onSelectWarehouse={(id) => {
          setActiveWarehouse(id);
          syncUrl({ wh: id });
        }}
        workers={workers}
      />

      {/* Main Workspace */}
      <div className="glass-card">
        <div style={{ padding: '16px 16px 0' }}>
          <WorkspaceTabs activeTab={url.tab} onChange={(tab) => setUrl({ tab })} counts={tabCounts} />
        </div>

        {url.tab === 'insumos' && (
          <>
            <InventoryToolbar
              search={url.q}
              setSearch={(q) => syncUrl({ q })}
              categoryFilter={categoryFilter}
              setCategoryFilter={(c) => { setCategoryFilter(c); syncUrl({ cat: c }); }}
              warehouseFilter={activeWarehouse}
              setWarehouseFilter={(w) => { setActiveWarehouse(w); syncUrl({ wh: w }); }}
              warehouses={warehouses}
              statusFilter={url.st}
              setStatusFilter={(st) => syncUrl({ st })}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              onExport={handleExport}
            />

            <InventoryTable
              items={paginatedItems}
              warehouses={warehouses}
              getStatus={getStockStatus}
              permissions={{ canMove: perms.canMove, canEdit: perms.canEdit, canDelete: perms.canDelete }}
              sortKey={url.sort}
              sortDir={Number(url.dir)}
              onSort={(key) => {
                if (url.sort === key) {
                  syncUrl({ dir: url.dir === '1' ? '-1' : '1' });
                } else {
                  syncUrl({ sort: key, dir: '1' });
                }
              }}
              onViewItem={(item) => {
                setSelectedItem(item);
                setIsViewOpen(true);
              }}
              onMoveItem={(item) => {
                setSelectedItem(item);
                setIsMoveOpen(true);
              }}
              onEditItem={(item) => {
                setEditingItem(item);
                setIsItemModalOpen(true);
              }}
              onDeleteItem={(id) => {
                const it = items.find((i) => i.id === id);
                setPendingDelete({ kind: 'item', id, name: it?.name || '' });
              }}
            />

            <InventoryPagination
              currentPage={currentPage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={filteredItems.length}
              onPageChange={(p) => { setCurrentPage(p); syncUrl({ page: String(p) }); }}
            />
          </>
        )}

        {url.tab === 'bodegas' && (
          <div style={{ padding: '0 16px 16px' }}>
            <WarehousesTab
              warehouses={warehouses}
              workers={workers}
              items={items}
              canManage={perms.canManageWarehouses}
              onViewItems={(whId) => {
                setActiveWarehouse(whId);
                setUrl({ tab: 'insumos', wh: whId });
              }}
              onManage={() => setIsManageWarehousesOpen(true)}
            />
          </div>
        )}

        {url.tab === 'movs' && (
          <div style={{ padding: '0 16px 16px' }}>
            <MovementsFeed
              movements={allMovements.length ? allMovements : movements}
              loading={movementsLoading}
              itemNameOf={itemNameOf}
              warehouseNameOf={warehouseNameOf}
            />
          </div>
        )}
      </div>

      {/* Add/Edit Item Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        warehouses={warehouses}
        initialItem={editingItem}
        onSave={handleSaveItem}
      />

      {/* Manage Warehouses Drawer */}
      <ManageWarehousesDrawer
        isOpen={isManageWarehousesOpen}
        onClose={() => setIsManageWarehousesOpen(false)}
        warehouses={warehouses}
        workers={workers}
        onCreateWarehouse={createWarehouse}
        onDeleteWarehouse={(id) => {
          const w = warehouses.find((x) => x.id === id);
          setPendingDelete({ kind: 'warehouse', id, name: w?.nombre || '' });
        }}
      />

      {/* View Item Details Modal */}
      <ViewItemModal
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        warehouseName={warehouses.find((w) => w.id === selectedItem?.warehouseId)?.nombre || 'Sin asignar'}
        movements={movements}
        movementsLoading={movementsLoading}
      />

      {/* Movement Modal (entrada/salida/ajuste/transferencia) */}
      <MovementModal
        isOpen={isMoveOpen}
        onClose={() => {
          setIsMoveOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        warehouses={warehouses}
        onAdjust={adjustStock}
        onTransfer={transferStock}
      />

      {/* Confirm delete (reutilizable, reemplaza window.confirm) */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete?.kind === 'item') deleteItem(pendingDelete.id);
          if (pendingDelete?.kind === 'warehouse') deleteWarehouse(pendingDelete.id);
        }}
        title={pendingDelete?.kind === 'warehouse' ? 'Eliminar bodega' : 'Eliminar artículo'}
        message={pendingDelete
          ? `Se eliminará "${pendingDelete.name}". ${pendingDelete.kind === 'warehouse' ? 'Sus artículos quedarán sin bodega.' : 'Esta acción quedará registrada en auditoría.'}`
          : ''}
        confirmLabel="Eliminar"
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
