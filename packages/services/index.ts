import { apiFetch } from '@skycrop/utils';
import { UserProfileResponse, Permiso } from '@skycrop/types';

// Detecta automáticamente la URL del API Backend según el entorno
const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3000' : 'https://backend.skycrop.app';
  }
  return 'http://localhost:3000';
};

export const AuthService = {
  /**
   * Obtiene el perfil completo del usuario (Usuario, Empresa, Rol y Permisos)
   * junto con el token temporal de Supabase.
   */
  async fetchUserProfile(clerkToken: string): Promise<UserProfileResponse> {
    const baseUrl = getApiUrl();
    return apiFetch<UserProfileResponse>(`${baseUrl}/api/auth/me`, clerkToken, {
      method: 'GET',
    });
  },

  /**
   * Realiza el logout del sistema limpiando las cookies y redirigiendo al portal.
   */
  logout(authUrl: string = 'https://auth.skycrop.app') {
    if (typeof window !== 'undefined') {
      window.location.href = `${authUrl}/sign-out`;
    }
  }
};

export const UserService = {
  async updateProfile(clerkToken: string, data: { nombre?: string; apellido?: string }) {
    const baseUrl = getApiUrl();
    return apiFetch(`${baseUrl}/api/users/profile`, clerkToken, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
};

export const EmpresaService = {
  async updateCompany(clerkToken: string, data: { nombre: string }) {
    const baseUrl = getApiUrl();
    return apiFetch(`${baseUrl}/api/empresas/current`, clerkToken, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
};

export const PermissionService = {
  /**
   * Verifica si el conjunto de permisos tiene acceso a un recurso y acción específicos.
   */
  hasPermission(permissions: Permiso[], recurso: string, accion: string): boolean {
    if (!permissions || !Array.isArray(permissions)) return false;
    
    return permissions.some(p => {
      // Si tiene permiso 'todo' en el recurso, concede el acceso
      const matchRecurso = p.recurso === recurso || p.recurso === '*';
      const matchAccion = p.accion === accion || p.accion === 'todo' || p.accion === '*';
      return matchRecurso && matchAccion;
    });
  },

  /**
   * Verifica si el usuario tiene al menos uno de los permisos provistos.
   */
  hasAnyPermission(permissions: Permiso[], checks: { recurso: string; accion: string }[]): boolean {
    return checks.some(check => this.hasPermission(permissions, check.recurso, check.accion));
  }
};
