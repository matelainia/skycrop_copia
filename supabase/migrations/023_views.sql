-- ==============================================================================
-- SKYCROP DATABASE V2: 023_views.sql
-- Descripción: Vistas de Compatibilidad Heredada y Analíticas
-- ==============================================================================

-- 1. Vista de Compatibilidad: usuarios
-- Simula la antigua tabla usuarios de V1 utilizando perfiles y membresías de Clerk
CREATE OR REPLACE VIEW public.usuarios AS
  SELECT 
    p.id,
    p.email,
    p.nombre,
    p.apellido,
    p.created_at,
    (SELECT company_id FROM public.company_users cu WHERE cu.clerk_user_id = p.id LIMIT 1) AS empresa_id,
    (SELECT role_id FROM public.company_users cu WHERE cu.clerk_user_id = p.id LIMIT 1) AS rol_id
  FROM public.profiles p;

-- 2. Trigger Function para manejar escrituras en la vista usuarios (Insert/Update/Delete)
CREATE OR REPLACE FUNCTION public.process_usuarios_view_write() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Upsert en la tabla base profiles
    INSERT INTO public.profiles (id, email, nombre, apellido, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.nombre,
      NEW.apellido,
      COALESCE(NEW.created_at, now()),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      nombre = COALESCE(EXCLUDED.nombre, profiles.nombre),
      apellido = COALESCE(EXCLUDED.apellido, profiles.apellido),
      updated_at = now();
      
    -- Si se provee empresa_id, crear o actualizar la membresía en company_users
    IF NEW.empresa_id IS NOT NULL THEN
      INSERT INTO public.company_users (company_id, clerk_user_id, role_id, activo, status)
      VALUES (
        NEW.empresa_id,
        NEW.id,
        COALESCE(NEW.rol_id, 'operario'),
        true,
        'active'
      )
      ON CONFLICT (company_id, clerk_user_id) DO UPDATE SET
        role_id = COALESCE(EXCLUDED.role_id, company_users.role_id),
        updated_at = now();
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Eliminar de la tabla base profiles (esto cascada a company_users)
    DELETE FROM public.profiles WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger en la vista usuarios
DROP TRIGGER IF EXISTS usuarios_view_write_trg ON public.usuarios;
CREATE TRIGGER usuarios_view_write_trg
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.process_usuarios_view_write();
