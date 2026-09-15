import { createClient } from '@supabase/supabase-js';

const isDev = import.meta.env.DEV;
const backendUrl = isDev
  ? 'http://localhost:3000/api'
  : 'https://backend.skycrop.app/api';

// Configuración de Supabase Directo
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gynttnymneanbziywqqr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mock_key';

// 1. Cliente por defecto (apunta al backend proxy con la dummy key)
const defaultClient = createClient(backendUrl, 'dummy-key');

// Cliente activo (se actualizará con el token RLS al iniciar sesión)
let activeClient = null;
let activeOrgId = null; // Guardará el org_id de Clerk de forma activa

// Suscriptores de cambio de sesión (p.ej. módulos que deben esperar al token
// antes del primer fetch en lugar de pedir anónimo al montar).
const authListeners = new Set();

/** true cuando hay token de usuario (nunca asumir autenticado sin esto). */
export function isAuthenticated() {
  return activeClient !== null;
}

/** Suscribe cb(autenticado:boolean). Devuelve unsubscribe. */
export function subscribeAuthChange(cb) {
  authListeners.add(cb);
  return () => {
    authListeners.delete(cb);
  };
}

function notifyAuthChange() {
  authListeners.forEach((cb) => {
    try {
      cb(activeClient !== null);
    } catch (err) {
      console.warn('Auth listener falló:', err?.message || err);
    }
  });
}

const TENANT_TABLES = [
  'lotes', 'maquinaria', 'inventario', 'trabajadores', 'cosechas',
  'monitoreos', 'aplicaciones', 'bodegas', 'labores',
  'jornadas_maquinaria', 'nominas', 'cursos_formacion',
  // Maquinaria canónica 052 (flota + operaciones + mantenimiento + combustible + eventos)
  'maquinaria_operaciones', 'maquinaria_mantenimientos',
  'maquinaria_combustible', 'maquinaria_eventos',
  'registros_formacion', 'cuadrillas', 'almacenamientos', 'audit_logs',
  // TH Fase 1 (F1.7): puentes con company_id propio también filtrados por tenant
  'labor_trabajadores', 'cuadrilla_miembros',
  // Cosecha y Postcosecha — trazabilidad completa (RLS + proxy)
  'lotes_producto', 'procesos_postcosecha', 'clientes', 'destinos',
  'ventas', 'venta_detalles', 'despachos', 'facturas', 'factura_detalles',
  'planificacion_cosechas', 'costos', 'predios',
  // Fertilización — multiempresa estricta (RLS + proxy)
  'fertilization_plans', 'fertilization_plan_items', 'fertilization_applications',
  'fertilization_observations', 'fertilization_observation_comments',
  'fertilization_observation_attachments', 'fertilization_observation_nutrients',
  'fertilization_alerts', 'fertilization_field_conditions',
  'fertilizacion_recomendaciones', 'fertilizacion_recomendacion_detalle',
  'fert_calc_soil_analyses', 'fert_calc_calculations', 'fert_calc_calculation_snapshots',
  // Análisis de Suelos — documental + analítico (RLS + proxy)
  'analisis_suelos', 'resultados_analisis_suelo', 'laboratorios',
  // Trazabilidad — evidencia productiva inmutable (solo INSERT/SELECT tenant)
  'traceability_events'
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Proxy dinámico para interceptar todas las llamadas al objeto 'supabase'.
 * De esta manera, el resto de componentes pueden seguir importando y usando 'supabase' directamente
 * sin enterarse de si están usando el canal directo con RLS o el canal del backend proxy.
 */
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = activeClient || defaultClient;

    // Centralizar el filtrado de inquilino interceptando el método 'from'
    if (prop === 'from') {
      return (tableName) => {
        const builder = client.from(tableName);
        const isValidUuid = typeof activeOrgId === 'string' && UUID_REGEX.test(activeOrgId);
        
        if (TENANT_TABLES.includes(tableName) && isValidUuid) {
          // Retornar un proxy sobre el builder para inyectar automáticamente el filtro del tenant
          return new Proxy(builder, {
            get(builderTarget, builderProp) {
              const originalMethod = Reflect.get(builderTarget, builderProp);
              
              if (typeof originalMethod === 'function') {
                if (builderProp === 'select') {
                  return (...args) => {
                    return originalMethod.apply(builderTarget, args).eq('company_id', activeOrgId);
                  };
                }
                if (builderProp === 'update') {
                  return (values, ...args) => {
                    const valuesWithTenant = { ...values, company_id: activeOrgId };
                    return originalMethod.apply(builderTarget, [valuesWithTenant, ...args]).eq('company_id', activeOrgId);
                  };
                }
                if (builderProp === 'delete') {
                  return (...args) => {
                    return originalMethod.apply(builderTarget, args).eq('company_id', activeOrgId);
                  };
                }
                if (builderProp === 'insert') {
                  return (values, ...args) => {
                    const valuesWithTenant = Array.isArray(values)
                      ? values.map(v => ({ ...v, company_id: activeOrgId }))
                      : { ...values, company_id: activeOrgId };
                    return originalMethod.apply(builderTarget, [valuesWithTenant, ...args]);
                  };
                }
              }
              // Asegurar el enlace de contexto correcto para otros métodos del builder (ej. order, limit, match)
              return typeof originalMethod === 'function' ? originalMethod.bind(builderTarget) : originalMethod;
            }
          });
        }
        return builder;
      };
    }

    const value = Reflect.get(client, prop);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

/**
 * Establece el token JWT firmado de Supabase para habilitar RLS.
 *
 * El token (emitido por /api/v1/auth/me) se usa como clave del cliente contra el
 * proxy del backend: así cada petición REST/RPC/Storage viaja con un JWT verificado
 * y Supabase aplica las políticas RLS del tenant correcto.
 * También se persiste en sessionStorage para las capas fetch manuales
 * (ej. plan-detail.api.js).
 */
export function setSupabaseToken(token, orgId = null) {
  activeOrgId = orgId;
  if (token) {    try {
      // Solo sessionStorage (no localStorage) reduce persistencia ante XSS y evita
      // que el token sobreviva entre sesiones del navegador.
      sessionStorage.setItem('sb_access_token', token);
      // Limpiar posible token legado en localStorage
      try { localStorage.removeItem('sb_access_token'); } catch {}
    } catch (_e) {
      /* almacenamiento no disponible: se continúa solo con el cliente */
    }
    activeClient = createClient(backendUrl, token);
    notifyAuthChange();
  } else {
    try {
      sessionStorage.removeItem('sb_access_token');
      localStorage.removeItem('sb_access_token');
    } catch (_e) {
      /* noop */
    }
    // Sin token: canal por defecto (dummy-key) hacia el proxy del backend
    activeClient = null;
    notifyAuthChange();
  }
}
