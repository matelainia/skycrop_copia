/**
 * SKYCROP E2E REAL — Matriz formal de roles y permisos (plan §2).
 *
 * Fuente de verdad para las pruebas de autorización. Veredictos:
 *   ALLOW — la operación debe tener éxito.
 *   DENY  — debe ser rechazada (RLS / trigger / CHECK / policy).
 *   COND  — permitida solo si se cumple `condicion`.
 *
 * Roles de prueba (solo TEST/STAGING, nunca reales):
 *   administrador, supervisor, operario, limitado (alcance restringido),
 *   externo (otra empresa), sin_predio (empresa A, sin predio asignado).
 *
 * Notas de diseño real (verificadas en migraciones):
 *  - Trazabilidad: creación solo vía RPC del sistema; UPDATE/DELETE = NO para todos.
 *  - Auditoría (audit_logs): solo INSERT/SELECT del tenant; UPDATE/DELETE = NO.
 *  - Borrados críticos: soft-delete (deleted_at/deleted_by) donde la tabla lo soporta.
 */

export const ROLES = ['administrador', 'supervisor', 'operario', 'limitado', 'externo', 'sin_predio'];
export const MODULES = [
  'empresa', 'predio', 'labores', 'maquinaria', 'aplicaciones', 'fertilizacion',
  'sanitario', 'suelos', 'cosecha', 'ventas', 'facturacion', 'trazabilidad'
];
export const ACTIONS = ['leer', 'crear', 'editar', 'eliminar', 'administrar'];

// D = DENY por defecto; cada celda ausente = DENY (fail-closed, igual que RLS).
const M = {
  empresa: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'ALLOW', limitado: 'COND', externo: 'DENY', sin_predio: 'ALLOW' },
    crear: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  predio: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  labores: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'COND', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  maquinaria: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'COND', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  aplicaciones: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'COND', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  fertilizacion: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'COND', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  sanitario: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'COND', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  suelos: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'ALLOW', supervisor: 'COND', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  cosecha: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  ventas: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'COND', supervisor: 'COND', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  facturacion: {
    leer: { administrador: 'ALLOW', supervisor: 'COND', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'ALLOW', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  },
  trazabilidad: {
    leer: { administrador: 'ALLOW', supervisor: 'ALLOW', operario: 'COND', limitado: 'COND', externo: 'DENY', sin_predio: 'DENY' },
    crear: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    editar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    eliminar: { administrador: 'DENY', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' },
    administrar: { administrador: 'COND', supervisor: 'DENY', operario: 'DENY', limitado: 'DENY', externo: 'DENY', sin_predio: 'DENY' }
  }
};

export const CONDICIONES = {
  'empresa.leer.limitado': 'solo su empresa',
  'predio.leer.operario': 'solo predios asignados',
  'predio.leer.limitado': 'solo predio asignado',
  'labores.leer.operario': 'propias/asignadas',
  'labores.leer.limitado': 'solo asignadas visibles',
  'labores.crear.operario': 'solo registro de ejecución asignada',
  'labores.editar.supervisor': 'no cerradas; mismo tenant',
  'labores.editar.operario': 'solo propias no cerradas',
  'labores.eliminar.administrador': 'solo soft-delete auditado',
  'maquinaria.leer.operario': 'empresa/predio asignado',
  'maquinaria.editar.supervisor': 'no cerradas',
  'maquinaria.editar.operario': 'solo horómetro propio',
  'maquinaria.eliminar.administrador': 'solo soft-delete auditado',
  'aplicaciones.editar.supervisor': 'según estado (no ejecutada/cerrada)',
  'aplicaciones.editar.operario': 'solo propias no ejecutadas',
  'aplicaciones.eliminar.administrador': 'solo soft-delete auditado',
  'facturacion.leer.supervisor': 'lectura, sin emitir',
  'ventas.editar.administrador': 'según estado (no ENTREGADA/ANULADA)',
  'ventas.editar.supervisor': 'solo BORRADOR→CONFIRMADA',
  'cosecha.editar.administrador': 'corrección auditada, nunca DELETE',
  'trazabilidad.leer.operario': 'según alcance (su empresa/predio)',
  'trazabilidad.administrar.administrador': 'verificación/exportación, nunca mutación'
};

/** Veredicto esperado. COND cuenta como ALLOW-condicionado en ejecución real del propio alcance. */
export function expected(rol, modulo, accion) {
  const v = M[modulo]?.[accion]?.[rol];
  return v || 'DENY';
}

export function condicionDe(rol, modulo, accion) {
  return CONDICIONES[`${modulo}.${accion}.${rol}`] || null;
}

/** Self-check: toda combinación rol×módulo×acción tiene veredicto explícito. */
export function assertMatrixComplete() {
  const faltantes = [];
  for (const mod of MODULES)
    for (const acc of ACTIONS)
      for (const rol of ROLES)
        if (!M[mod]?.[acc]?.[rol]) faltantes.push(`${mod}.${acc}.${rol}`);
  if (faltantes.length) throw new Error(`Matriz incompleta (${faltantes.length}): ${faltantes.slice(0, 8).join(', ')}…`);
  return { roles: ROLES.length, modulos: MODULES.length, acciones: ACTIONS.length, celdas: ROLES.length * MODULES.length * ACTIONS.length };
}
