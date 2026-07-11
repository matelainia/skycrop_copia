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

/**
 * Proxy dinámico para interceptar todas las llamadas al objeto 'supabase'.
 * De esta manera, el resto de componentes pueden seguir importando y usando 'supabase' directamente
 * sin enterarse de si están usando el canal directo con RLS o el canal del backend proxy.
 */
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = activeClient || defaultClient;
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
export function setSupabaseToken(token) {
  if (token) {
    activeClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    console.log('[SUPABASE CLIENT] Conexión directa RLS activada con nuevo JWT.');
  } else {
    activeClient = null;
    console.log('[SUPABASE CLIENT] Conexión directa RLS desactivada. Usando Proxy Backend.');
  }
}
