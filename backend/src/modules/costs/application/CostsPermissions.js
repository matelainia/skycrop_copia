import { supabaseAdmin } from '../../../shared/database/supabase.js';
import { AuthorizationError } from '../../../shared/errors/AppErrors.js';

/**
 * Autorización explícita del backend para Costos (cierre §3).
 * Las RPC 066 son no-op de permisos en ruta service_role por diseño (037);
 * por tanto el backend verifica el permiso ANTES de invocarlas.
 * Réplica exacta de has_permission(060): (recurso='*' o igual) y
 * (accion='todo'/'*' o igual). Recurso fijo 'costos'.
 *
 * Acciones por operación:
 *   register/value/allocate/post → 'crear' · lecturas → 'leer'
 *   reverse → 'eliminar' · recalculate → 'editar'
 */

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // `${companyId}|${userId}` → { perms:Set<string>, roleId, exp }

export function isAllowed(permRows, recurso, accion) {
  return (permRows || []).some(
    (p) =>
      (p.recurso === recurso || p.recurso === '*') &&
      (p.accion === accion || p.accion === 'todo' || p.accion === '*')
  );
}

async function loadPerms(companyId, userId) {
  const key = `${companyId}|${userId}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit;

  const { data: membership, error: mErr } = await supabaseAdmin
    .from('company_users')
    .select('role_id')
    .eq('company_id', companyId)
    .eq('clerk_user_id', userId)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership?.role_id) {
    const empty = { perms: [], roleId: null, exp: Date.now() + CACHE_TTL_MS };
    cache.set(key, empty);
    return empty;
  }
  const { data: rows, error: pErr } = await supabaseAdmin
    .from('permisos')
    .select('recurso, accion')
    .eq('rol_id', membership.role_id);
  if (pErr) throw pErr;
  const entry = { perms: rows || [], roleId: membership.role_id, exp: Date.now() + CACHE_TTL_MS };
  cache.set(key, entry);
  return entry;
}

export async function assertCostsPermission(companyId, userId, accion, recurso = 'costos') {
  if (!companyId || !userId) throw new AuthorizationError('Empresa o usuario no identificados.');
  let entry;
  try {
    entry = await loadPerms(companyId, userId);
  } catch {
    throw new AuthorizationError('No se pudo verificar el permiso de costos.');
  }
  if (!isAllowed(entry.perms, recurso, accion)) {
    const err = new AuthorizationError(`Sin permiso para costos:${accion}.`);
    err.details = { recurso, accion };
    throw err;
  }
  return entry.roleId;
}

export function _clearCostsPermCache() {
  cache.clear();
}

export default { assertCostsPermission, isAllowed };
