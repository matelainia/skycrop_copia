/**
 * harvestCalculations — lógica de negocio pura, sin JSX, testeable.
 * Todas las funciones operan sobre datos reales, nunca inventan.
 */

export function calcularRendimiento(cantidadKg, areaHa) {
  if (!cantidadKg || !areaHa || areaHa <= 0) return 0;
  return cantidadKg / areaHa;
}

export function calcularMermaAbsoluta(pesoInicial, pesoFinal) {
  if (pesoInicial == null || pesoFinal == null) return null;
  return Math.max(0, pesoInicial - pesoFinal);
}

export function calcularMermaPorcentual(pesoInicial, pesoFinal) {
  if (!pesoInicial || pesoInicial <= 0 || pesoFinal == null) return null;
  return ((pesoInicial - pesoFinal) / pesoInicial) * 100;
}

export function clasificarMerma({ mermaPct, esDescarte, esSubproducto, esHumedad }) {
  if (esDescarte) return 'descarte';
  if (esSubproducto) return 'subproducto';
  if (esHumedad) return 'humedad_perdida';
  if (mermaPct != null && mermaPct > 15) return 'merma_alta';
  if (mermaPct != null && mermaPct > 5) return 'merma_media';
  return 'merma_baja';
}

export function calcularDisponibleBodega(movimientos) {
  // movimientos: [{tipo, cantidad}]
  let stock = 0;
  for (const m of movimientos) {
    if (m.tipo === 'entrada') stock += m.cantidad;
    else if (m.tipo === 'salida' || m.tipo === 'merma' || m.tipo === 'reserva') stock -= m.cantidad;
    else if (m.tipo === 'transferencia') stock += 0; // depende origen/destino, simplificado
  }
  return Math.max(0, stock);
}

export function validarVentaDisponible(stockKg, solicitadoKg) {
  if (solicitadoKg <= 0) return { ok: false, error: 'Cantidad debe ser > 0' };
  if (solicitadoKg > stockKg) return { ok: false, error: `Stock insuficiente: disponible ${stockKg.toFixed(1)} kg` };
  return { ok: true };
}

export function formatearKg(kg) {
  if (kg == null) return '—';
  if (kg >= 1000) return (kg / 1000).toFixed(2) + ' T';
  return kg.toFixed(0) + ' kg';
}

export function formatearHa(ha) {
  if (ha == null) return '—';
  return ha.toFixed(2) + ' ha';
}
