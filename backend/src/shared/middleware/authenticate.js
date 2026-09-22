/**
 * Middleware de autenticación e identidad de tenant para los routers modulares.
 *
 * Verifica el token Bearer del request y deriva la identidad REAL del usuario:
 *   1. JWT firmado por este backend con SUPABASE_JWT_SECRET (emitido por /auth/me o proxy legacy)
 *   2. Token de sesión de Clerk (verificación de firma vía @clerk/backend)
 *
 * Puebla en el request:
 *   req.auth   = { userId, orgId, email }        (identidad cruda del token verificado)
 *   req.tenant = { companyId, userId, roleName } (companyId resuelto a UUID de companies)
 *
 * Política:
 *   - PRODUCCIÓN: peticiones sin token válido son rechazadas con 401 cuando se usa
 *     requireAuth(). Con optionalAuth() se permite continuar sin identidad (endpoints públicos).
 *   - DESARROLLO: si no hay token válido se continúa sin identidad para no romper flujos
 *     locales existentes; los controladores aplican sus fallbacks históricos.
 */
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { supabaseAdmin } from '../database/supabase.js';
import { AuthenticationError } from '../errors/AppErrors.js';
import { ClerkAuthService } from '../../modules/auth/infrastructure/adapters/outbound/ClerkAuthService.js';

const clerkAuthService = new ClerkAuthService();

const isProduction = env.NODE_ENV === 'production';

// Caché de resolución clerk_org_id -> company UUID (evita round-trips por request)
const companyUuidCache = new Map();
const COMPANY_CACHE_TTL_MS = 10 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveCompanyUuid(orgId) {
  if (!orgId) return null;
  const cached = companyUuidCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached.uuid;

  try {
    // El JWT emitido por este backend trae org_id = companies.id (UUID) para
    // que RLS (current_company) lo use directo. Si ya es un UUID de empresa
    // válido, usarlo sin pasar por clerk_org_id (si no, el lookup falla y el
    // tenant queda null → "Empresa no identificada" en todos los módulos).
    if (UUID_RE.test(orgId)) {
      const { data: byId, error: errById } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('id', orgId)
        .limit(1)
        .maybeSingle();
      if (!errById && byId?.id) {
        companyUuidCache.set(orgId, {
          uuid: byId.id,
          expiresAt: Date.now() + COMPANY_CACHE_TTL_MS
        });
        return byId.id;
      }
    }
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('clerk_org_id', orgId)
      .limit(1)
      .maybeSingle();
    if (error || !data?.id) return cached ? cached.uuid : null;
    companyUuidCache.set(orgId, {
      uuid: data.id,
      expiresAt: Date.now() + COMPANY_CACHE_TTL_MS
    });
    return data.id;
  } catch {
    return cached ? cached.uuid : null;
  }
}

function bearerToken(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token || token === 'dummy-key' || token.includes('sb_publishable_')) return null;
  return token;
}

/**
 * Verifica el token del request y adjunta req.auth / req.tenant.
 * Nunca lanza: los controladores deciden qué hacer si la identidad falta.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const token = bearerToken(req);
    if (token) {
      let payload = null;

      // 1. ¿JWT emitido por este backend? (expiración estricta)
      payload = (() => {
        try {
          return jwt.verify(token, env.SUPABASE_JWT_SECRET);
        } catch (err) {
          // Token expirado o firma inválida → no se acepta como identidad válida.
          // El cliente debe refrescar vía Clerk (/auth/me) con su sesión vigente.
          if (err && err.name === 'TokenExpiredError') {
            console.warn('[AUTH] Supabase JWT expirado rechazado; requiere refresh vía Clerk.');
          }
          return null;
        }
      })();

      // 2. Si no es nuestro JWT, verificar como token de sesión de Clerk
      if (!payload) {
        try {
          payload = await clerkAuthService.verifySessionToken(token);
        } catch {
          payload = null;
        }
      }

      if (payload && payload.sub) {
        const orgId = payload.org_id || payload.orgId || payload.o?.id || null;
        req.auth = {
          userId: payload.sub,
          orgId,
          roleName: payload.role_name || payload.roleName || payload.org_role || null,
          email: payload.email || null
        };
        req.tenant = {
          companyId: await resolveCompanyUuid(orgId),
          userId: payload.sub,
          roleName: req.auth.roleName
        };
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Variante estricta: exige identidad verificada (401 en producción).
 * En desarrollo continúa sin identidad para preservar los flujos locales.
 */
export async function requireAuth(req, res, next) {
  await optionalAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.auth) {
      if (isProduction) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Autenticación requerida.' }
        });
      }
      console.warn('[AUTH] [DEV] Petición sin token válido aceptada por compatibilidad.');
    }
    next();
  });
}

/**
 * Helper para controladores: devuelve la identidad priorizando el token verificado.
 * Los valores enviados por el cliente (body/query) solo se usan cuando NO hay
 * identidad verificada Y estamos fuera de producción (compatibilidad dev).
 */
export function resolveTenant(req, { fallbackCompanyId = null, fallbackUserId = null } = {}) {
  if (req.tenant && req.tenant.userId) {
    return {
      companyId: req.tenant.companyId || fallbackCompanyId,
      userId: req.tenant.userId,
      userName: req.auth.email || 'Usuario'
    };
  }
  if (isProduction) {
    throw new AuthenticationError('Autenticación requerida para esta operación.');
  }
  return { companyId: fallbackCompanyId, userId: fallbackUserId, userName: 'Usuario Dev' };
}
