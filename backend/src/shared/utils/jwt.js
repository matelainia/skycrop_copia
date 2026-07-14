import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Genera un token JWT de Supabase firmado para el usuario y organización (tenant) especificados,
 * habilitando RLS (Row Level Security) directamente en las consultas.
 *
 * @param {string} userId ID del usuario en Clerk
 * @param {string} email Correo electrónico del usuario
 * @param {string} orgId ID de la organización activa en Clerk (tenant)
 * @param {string} role Nombre del rol del usuario para mapear permisos
 */
export function generateSupabaseJwt(userId, email, orgId, role) {
  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 15, // Válido por 15 minutos
    sub: userId,
    email: email,
    role: 'authenticated',
    app_metadata: {
      provider: 'clerk',
      providers: ['clerk']
    },
    user_metadata: {},
    org_id: orgId,
    role_name: role
  };

  return jwt.sign(payload, env.SUPABASE_JWT_SECRET);
}
