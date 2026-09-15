/**
 * Traduce errores de PostgREST/RPC a mensajes de UI en español.
 * Las RPC del contrato devuelven 'CODIGO: mensaje'; aquí se mapea el código
 * a texto operativo (p.ej. concurrencia → refrescar estado).
 */
const CODE_MESSAGES = {
  ACCESO_DENEGADO: 'Acceso denegado. Verifica tu empresa y permisos.',
  MAQUINA_NO_OPERABLE:
    'La máquina no está disponible para esta operación. Revisa su estado.',
  JORNADA_ACTIVA_EXISTE:
    'Esta maquinaria acaba de ser asignada a otra operación. Actualiza el estado para continuar.',
  HOROMETRO_REGRESIVO:
    'El horómetro no puede ser menor que la última lectura registrada.',
  LOTE_FUERA_DE_TENANT:
    'El lote no pertenece a tu empresa. Selecciónalo de la lista de lotes.',
  OPERADOR_FUERA_DE_TENANT:
    'El operador no pertenece a tu empresa.',
  ESTADO_INVALIDO:
    'La operación no es válida en el estado actual del registro.',
  HISTORICO_INMUTABLE:
    'Este registro es histórico y no puede modificarse. Registra una corrección nueva si aplica.',
  COMBUSTIBLE_INVALIDO:
    'Revisa los datos de combustible: cantidad mayor que cero y horómetro válido.',
  MANTENIMIENTO_INVALIDO:
    'Revisa los datos de mantenimiento: tipo, fechas y horómetro.'
};

export function translateRpcError(err, fallback = 'No se pudo completar la operación. Reintenta.') {
  const raw = err?.message || String(err || '');
  const code = raw.split(':')[0]?.trim();

  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }
  // unique violation: código duplicado o doble jornada concurrente.
  if (err?.code === '23505' || raw.includes('duplicate key value')) {
    if (raw.includes('maquinaria') || raw.includes('codigo')) {
      return 'Ya existe un equipo con ese código en tu empresa.';
    }
    return 'Esta maquinaria acaba de ser asignada a otra operación. Actualiza el estado para continuar.';
  }
  // FK restrict: eliminar con historial.
  if (err?.code === '23503' || raw.includes('violates foreign key')) {
    return 'No se puede eliminar: el equipo tiene operaciones o historial. Retíralo (Fuera de servicio) en lugar de eliminarlo.';
  }
  return raw || fallback;
}

export default translateRpcError;
