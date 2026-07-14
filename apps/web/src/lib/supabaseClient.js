import { createClient } from '@supabase/supabase-js';

const isDev = import.meta.env.DEV;
const backendUrl = isDev
  ? 'http://localhost:3000/api'
  : 'https://backend.skycrop.app/api';

// Configuración de Supabase Directo
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fxcasqkwkiytbckvtgag.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mock_key';

// 1. Cliente por defecto (apunta al backend proxy con la dummy key)
const defaultClient = createClient(backendUrl, 'dummy-key');

// Cliente activo (se actualizará con el token RLS al iniciar sesión)
let activeClient = null;
let activeOrgId = null; // Guardará el org_id de Clerk de forma activa

const TENANT_TABLES = [
  'lotes', 'maquinaria', 'inventario', 'trabajadores', 'cosechas',
  'monitoreos', 'aplicaciones', 'bodegas', 'labores',
  'jornadas_maquinaria', 'nominas', 'cursos_formacion',
  'registros_formacion', 'cuadrillas', 'almacenamientos', 'audit_logs'
];

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
        
        if (TENANT_TABLES.includes(tableName) && activeOrgId) {
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
 * Establece el token JWT firmado de Supabase para habilitar RLS directo
 */
export function setSupabaseToken(token, orgId = null) {
  activeOrgId = orgId;
  if (token) {
    activeClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    console.log(`[SUPABASE CLIENT] Conexión directa RLS activada con nuevo JWT para el tenant: ${orgId}`);
  } else {
    activeClient = null;
    console.log('[SUPABASE CLIENT] Conexión directa RLS desactivada. Usando Proxy Backend.');
  }
}
