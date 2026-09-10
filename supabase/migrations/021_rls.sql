-- ==============================================================================
-- SKYCROP DATABASE V2: 021_rls.sql
-- Descripción: Activación de Row Level Security (RLS) y Definición de Políticas
-- ==============================================================================

-- 1. FUNCIONES AUXILIARES DE CONTEXTO (Requeridas para evaluar las políticas RLS)
CREATE OR REPLACE FUNCTION public.current_company() RETURNS UUID AS $$
DECLARE
  v_org_id TEXT;
BEGIN
  -- Intentar extraer el claim org_id del JWT de Supabase
  v_org_id := auth.jwt() ->> 'org_id';
  IF v_org_id IS NULL THEN
    RETURN '00000000-0000-0000-0000-000000000000'::uuid; -- Empresa Semilla/Demo
  END IF;
  RETURN v_org_id::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN '00000000-0000-0000-0000-000000000000'::uuid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(auth.jwt() ->> 'sub', 'sistema_api');
EXCEPTION WHEN OTHERS THEN
  RETURN 'sistema_api';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Habilitar RLS en todas las tablas operativas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trabajadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuadrillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuadrilla_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almacenamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_trabajadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planificacion_cosechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aplicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornadas_maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoreos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_aplicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_sanitaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_prescripcion_alta_toxicidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- 3. Definición de la Función de Consulta de Rol del Inquilino
CREATE OR REPLACE FUNCTION public.current_role_id() RETURNS TEXT AS $$
DECLARE
  v_role_id TEXT;
BEGIN
  SELECT role_id INTO v_role_id
  FROM public.company_users
  WHERE company_id = public.current_company()
    AND clerk_user_id = public.current_user_id()
    AND activo = true
  LIMIT 1;
  RETURN COALESCE(v_role_id, 'operario');
EXCEPTION WHEN OTHERS THEN
  RETURN 'operario';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 4. POLÍTICAS RLS PARA TABLAS CORE

-- 4.1. Companies
CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated USING (id = public.current_company());
CREATE POLICY companies_all_admin ON public.companies FOR ALL TO authenticated 
  USING (id = public.current_company() AND public.current_role_id() IN ('administrador', 'gerente'))
  WITH CHECK (id = public.current_company() AND public.current_role_id() IN ('administrador', 'gerente'));

-- 4.2. Profiles
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated 
  USING (
    id = public.current_user_id() OR 
    EXISTS (
      SELECT 1 FROM public.company_users cu1
      JOIN public.company_users cu2 ON cu1.company_id = cu2.company_id
      WHERE cu1.clerk_user_id = public.current_user_id() AND cu2.clerk_user_id = public.profiles.id
    )
  );
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated 
  USING (id = public.current_user_id())
  WITH CHECK (id = public.current_user_id());

-- 4.3. Company Members (company_users)
CREATE POLICY company_users_select ON public.company_users FOR SELECT TO authenticated USING (company_id = public.current_company());
CREATE POLICY company_users_admin ON public.company_users FOR ALL TO authenticated 
  USING (company_id = public.current_company() AND public.current_role_id() IN ('administrador', 'gerente'))
  WITH CHECK (company_id = public.current_company() AND public.current_role_id() IN ('administrador', 'gerente'));

-- 4.4. Predios
CREATE POLICY predios_select ON public.predios FOR SELECT TO authenticated USING (company_id = public.current_company());
CREATE POLICY predios_all ON public.predios FOR ALL TO authenticated 
  USING (company_id = public.current_company())
  WITH CHECK (company_id = public.current_company());

-- 4.5. Lotes (Filtro por deleted_at para usuarios no admin o el usuario que lo eliminó)
CREATE POLICY lotes_select ON public.lotes FOR SELECT TO authenticated 
  USING (company_id = public.current_company() AND (deleted_at IS NULL OR public.current_role_id() = 'administrador' OR deleted_by = public.current_user_id()));
CREATE POLICY lotes_insert ON public.lotes FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company());
CREATE POLICY lotes_update ON public.lotes FOR UPDATE TO authenticated 
  USING (company_id = public.current_company()) WITH CHECK (company_id = public.current_company());
CREATE POLICY lotes_delete ON public.lotes FOR DELETE TO authenticated 
  USING (company_id = public.current_company() AND public.current_role_id() = 'administrador');


-- 5. POLÍTICAS RLS GENERALES MULTI-TENANT (Filtro simple de aislamiento)
-- Se aplica a tablas generales que tienen company_id

DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'trabajadores', 'cuadrillas', 'cuadrilla_miembros', 'bodegas', 'almacenamientos',
    'inventario', 'movimientos_inventario', 'labores', 'labor_trabajadores', 'planificacion_cosechas',
    'maquinaria', 'jornadas_maquinaria', 'historial_actividades', 'cursos_formacion', 'registros_formacion',
    'nominas', 'costos', 'audit_logs', 'security_events', 'cosechas', 'auditoria_sanitaria', 'auditoria_prescripcion_alta_toxicidad'
  ];
  has_deleted BOOLEAN;
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    -- Verificar si tiene columna de borrado lógico
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = t_name AND column_name = 'deleted_at'
    ) INTO has_deleted;

    -- SELECT Policy
    IF has_deleted THEN
      EXECUTE format(
        'CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated ' ||
        'USING (company_id = public.current_company() AND (deleted_at IS NULL OR public.current_role_id() = ''administrador'' OR deleted_by = public.current_user_id()))',
        t_name, t_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated ' ||
        'USING (company_id = public.current_company())',
        t_name, t_name
      );
    END IF;

    -- INSERT Policy
    EXECUTE format(
      'CREATE POLICY %I_insert_policy ON public.%I FOR INSERT TO authenticated ' ||
      'WITH CHECK (company_id = public.current_company())',
      t_name, t_name
    );

    -- UPDATE Policy
    EXECUTE format(
      'CREATE POLICY %I_update_policy ON public.%I FOR UPDATE TO authenticated ' ||
      'USING (company_id = public.current_company()) ' ||
      'WITH CHECK (company_id = public.current_company())',
      t_name, t_name
    );

    -- DELETE Policy (Físico solo para administradores)
    EXECUTE format(
      'CREATE POLICY %I_delete_policy ON public.%I FOR DELETE TO authenticated ' ||
      'USING (company_id = public.current_company() AND public.current_role_id() = ''administrador'')',
      t_name, t_name
    );
  END LOOP;
END $$;


-- 6. POLÍTICAS RLS CON VALIDACIÓN CRUZADA DE LOTES (Seguridad entre Módulos)
-- Se aplica a tablas dependientes de lote que deben verificar que lote_id pertenece al tenant

DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'aplicaciones', 'monitoreos', 'auditoria_aplicaciones'
  ];
  has_deleted BOOLEAN;
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    -- Verificar si tiene columna de borrado lógico
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = t_name AND column_name = 'deleted_at'
    ) INTO has_deleted;

    -- SELECT Policy
    IF has_deleted THEN
      EXECUTE format(
        'CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated ' ||
        'USING (company_id = public.current_company() AND (deleted_at IS NULL OR public.current_role_id() = ''administrador'' OR deleted_by = public.current_user_id()))',
        t_name, t_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated ' ||
        'USING (company_id = public.current_company())',
        t_name, t_name
      );
    END IF;

    -- INSERT Policy (Valida que lote_id pertenezca al tenant del JWT)
    EXECUTE format(
      'CREATE POLICY %I_insert_policy ON public.%I FOR INSERT TO authenticated ' ||
      'WITH CHECK (company_id = public.current_company() AND EXISTS (SELECT 1 FROM public.lotes WHERE lotes.id = lote_id AND lotes.company_id = public.current_company()))',
      t_name, t_name
    );

    -- UPDATE Policy (Valida lote_id)
    EXECUTE format(
      'CREATE POLICY %I_update_policy ON public.%I FOR UPDATE TO authenticated ' ||
      'USING (company_id = public.current_company()) ' ||
      'WITH CHECK (company_id = public.current_company() AND EXISTS (SELECT 1 FROM public.lotes WHERE lotes.id = lote_id AND lotes.company_id = public.current_company()))',
      t_name, t_name
    );

    -- DELETE Policy
    EXECUTE format(
      'CREATE POLICY %I_delete_policy ON public.%I FOR DELETE TO authenticated ' ||
      'USING (company_id = public.current_company() AND public.current_role_id() = ''administrador'')',
      t_name, t_name
    );
  END LOOP;
END $$;


-- 7. POLÍTICA RLS PARA PRODUCTOS (Catálogo Compartido/Flexible)
-- Permite leer productos globales (company_id IS NULL) y productos propios
CREATE POLICY productos_select_policy ON public.productos FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.current_company());

CREATE POLICY productos_write_policy ON public.productos FOR ALL TO authenticated
  USING (company_id = public.current_company())
  WITH CHECK (company_id = public.current_company());
