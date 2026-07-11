export interface Role {
  id: string; // 'gerente', 'administrador', 'ingeniero', 'supervisor', 'operario', 'auditor', 'invitado'
  nombre: string;
  descripcion?: string;
}

export interface Empresa {
  id: string; // UUID
  nombre: string;
  created_at: string;
}

export interface Usuario {
  id: string; // Clerk User ID
  email: string;
  nombre?: string;
  apellido?: string;
  empresa_id?: string;
  rol_id?: string;
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
  empresa: Empresa | null;
  role: Role | null;
  permissions: Permiso[];
  supabaseToken: string;
}
