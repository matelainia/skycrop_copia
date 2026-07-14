import { createClient } from '@supabase/supabase-js';
import env from '../config/env.js';

// Cliente con service_role para operaciones administrativas del backend
// (Bypassa RLS de forma segura únicamente para lógica interna verificada)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Retorna una instancia del cliente de Supabase vinculando los headers de autorización del usuario.
 * Esto asegura que la base de datos aplique las políticas RLS correspondientes al JWT recibido.
 *
 * @param {string} userJwt Token JWT firmado de Supabase correspondiente al usuario y tenant activo
 */
export function getSupabaseUserClient(userJwt) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`
      }
    }
  });
}

export default supabaseAdmin;
