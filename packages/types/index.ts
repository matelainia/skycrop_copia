export type CompanyRole = 'Owner' | 'Administrator' | 'Supervisor' | 'Operario';

export interface Role {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface Company {
  id: string; // Clerk Organization ID (e.g. 'org_3GSw...')
  nombre: string;
  slug?: string;
  logo?: string;
  estado?: string;
  created_at: string;
}

// Representa la vinculación de un usuario con un tenant
export interface Usuario {
  id: string; // Clerk User ID (e.g. 'user_...')
  email: string;
  nombre?: string;
  apellido?: string;
  company_id?: string;
  rol_id?: string; // Mapeado interno para control de permisos
  role?: CompanyRole; // Rol del ENUM multiempresa
  created_at: string;
}

export interface Permiso {
  id: string;
  rol_id: string;
  recurso: string; // 'lotes', 'maquinaria', 'inventario', 'cosechas', 'laboral'
  accion: string;  // 'leer', 'crear', 'editar', 'eliminar', 'todo'
}

export interface UserProfileResponse {
  user: Usuario;
  company: Company | null;
  empresa: Company | null; // Compatibilidad hacia atrás con código existente en el frontend
  role: Role | null;
  permissions: Permiso[];
  supabaseToken: string;
}

