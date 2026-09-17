// Export CSV del inventario (respeta filtros activos).
// NOTA auditoría: audit_logs.accion solo admite INSERT/UPDATE/DELETE/LOGIN/
// LOGOUT (019), por lo que el export se auditará en el endpoint dedicado
// (Fase 5 pendiente) en vez de insertar una fila inválida aquí.
export function exportInventoryCsv(rows = [], warehouseNameOf = () => '—', statusLabelOf = () => '') {
  const head = ['Artículo', 'SKU', 'Categoría', 'Unidad', 'Stock', 'Mínimo', 'Máximo', 'Bodega', 'Ubicación', 'Estado'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.join(',')].concat(
    rows.map((it) => [
      it.name, it.sku || '', it.category, it.unit, it.quantity,
      it.minQuantity, it.maxQuantity ?? '', warehouseNameOf(it.warehouseId),
      it.comentarios || '', statusLabelOf(it)
    ].map(esc).join(','))
  );
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `skycrop-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
