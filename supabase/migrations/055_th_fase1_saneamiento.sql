-- ==============================================================================
-- SKYCROP 055: Talento Humano Fase 1 — saneamiento estructural (sin features)
-- Cubre: F1.1 taxonomías, F1.2 integridad triangular, F1.4 auditoría/actor,
--        F1.5 modelo nómina, F1.6 soft-delete, F1.7 RBAC nóminas.
-- Tablas TH vacías en vivo salvo 2 trabajadores canónicos → sin backfill.
-- Idempotente: guards IF EXISTS en cada bloque. Aplicar en Dashboard SQL Editor.
-- ==============================================================================

-- ── F1.1: CHECKs canónicos (alineados a constants/taxonomia.js) ───────────────
ALTER TABLE public.labores DROP CONSTRAINT IF EXISTS labores_estado_check;
ALTER TABLE public.labores
  ADD CONSTRAINT labores_estado_check
  CHECK (estado IN ('Pendiente', 'En Progreso', 'Completada', 'Cancelada', 'Archivada'));

ALTER TABLE public.nominas DROP CONSTRAINT IF EXISTS nominas_estado_check;
ALTER TABLE public.nominas
  ADD CONSTRAINT nominas_estado_check
  CHECK (estado IN ('Procesando', 'Completado', 'Fallido', 'Vencida'));

ALTER TABLE public.registros_formacion DROP CONSTRAINT IF EXISTS registros_formacion_estado_check;
ALTER TABLE public.registros_formacion
  ADD CONSTRAINT registros_formacion_estado_check
  CHECK (estado IN ('Completada', 'En Curso', 'Vencida'));

-- ── F1.5: tasa hora-extra persistida + anti-doble-nómina ──────────────────────
ALTER TABLE public.nominas
  ADD COLUMN IF NOT EXISTS valor_hora_extra NUMERIC NOT NULL DEFAULT 0 CHECK (valor_hora_extra >= 0);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_nominas_company_trabajador_periodo') THEN
    ALTER TABLE public.nominas
      ADD CONSTRAINT uq_nominas_company_trabajador_periodo
      UNIQUE (company_id, trabajador_id, periodo);
  END IF;
END $$;

-- Recompute server-autoritativo: total = salario + horas*tasa − retenciones.
CREATE OR REPLACE FUNCTION public.process_nomina_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.total_neto := GREATEST(0,
    COALESCE(NEW.salario_neto, 0)
    + COALESCE(NEW.horas_extras, 0) * COALESCE(NEW.valor_hora_extra, 0)
    - COALESCE(NEW.retenciones, 0));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS nomina_total_trg ON public.nominas;
CREATE TRIGGER nomina_total_trg BEFORE INSERT OR UPDATE ON public.nominas
  FOR EACH ROW EXECUTE FUNCTION public.process_nomina_total();

-- ── F1.4: columnas actor + autofill server (nunca confiar cliente) ────────────
ALTER TABLE public.trabajadores ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.trabajadores ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.trabajadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.cuadrillas ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.cuadrillas ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.cuadrillas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.cuadrilla_miembros ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.labores ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.labores ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.labores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.labor_trabajadores ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.cursos_formacion ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.cursos_formacion ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.cursos_formacion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.registros_formacion ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.nominas ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.nominas ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE OR REPLACE FUNCTION public.process_th_actor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user TEXT; v_row JSONB;
BEGIN
  BEGIN v_user := public.current_user_id(); EXCEPTION WHEN OTHERS THEN v_user := NULL; END;
  v_row := to_jsonb(NEW);
  IF TG_OP = 'INSERT' THEN
    IF (v_row ->> 'created_by') IS NULL THEN
      BEGIN NEW.created_by := v_user; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN NEW.updated_by := v_user; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF (v_row ? 'updated_at') THEN NEW.updated_at := now(); END IF;
    -- F1.6: quien marca deleted_at queda registrado aunque el cliente no lo envíe.
    IF (v_row ? 'deleted_at') AND NEW.deleted_at IS NOT NULL
       AND ((v_row ->> 'deleted_by') IS NULL) THEN
      BEGIN NEW.deleted_by := v_user; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['trabajadores','cuadrillas','cuadrilla_miembros','labores',
    'labor_trabajadores','cursos_formacion','registros_formacion','nominas'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS th_actor_trg ON public.%I', t);
      EXECUTE format('CREATE TRIGGER th_actor_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_th_actor()', t);
    END IF;
  END LOOP;
END $$;

-- Cobertura auditoría server (patrón 022, solo si la función vive).
DO $$ DECLARE t TEXT; BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_audit_log') THEN
    FOREACH t IN ARRAY ARRAY['labores','nominas','cuadrillas','cursos_formacion','registros_formacion'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER audit_%I_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t, t);
    END LOOP;
  ELSE
    RAISE NOTICE '[055] omitido audit TH: falta process_audit_log (022 no aplicada)';
  END IF;
END $$;

-- ── F1.2: integridad triangular (RLS tenant ≠ integridad relacional) ──────────
CREATE OR REPLACE FUNCTION public.process_validate_th_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID; v_row JSONB; v_ref UUID; v_c UUID;
BEGIN
  v_row := to_jsonb(NEW);
  BEGIN v_company := (v_row ->> 'company_id')::UUID; EXCEPTION WHEN OTHERS THEN v_company := NULL; END;
  IF v_company IS NULL THEN v_company := public.current_company(); END IF;

  -- Cada FK declarada en el trigger debe pertenecer al mismo tenant.
  IF TG_TABLE_NAME IN ('cuadrilla_miembros','labor_trabajadores','nominas','registros_formacion','labores') THEN
    -- trabajador_id (si la tabla lo tiene y no es NULL)
    BEGIN v_ref := NULLIF(v_row ->> 'trabajador_id','')::UUID; EXCEPTION WHEN OTHERS THEN v_ref := NULL; END;
    IF v_ref IS NOT NULL THEN
      SELECT company_id INTO v_c FROM public.trabajadores WHERE id = v_ref;
      IF NOT FOUND OR v_c IS DISTINCT FROM v_company THEN
        RAISE EXCEPTION 'Trabajador % no pertenece a la empresa % (tabla %).', v_ref, v_company, TG_TABLE_NAME USING ERRCODE='42501';
      END IF;
    END IF;
    -- labor_id
    BEGIN v_ref := NULLIF(v_row ->> 'labor_id','')::UUID; EXCEPTION WHEN OTHERS THEN v_ref := NULL; END;
    IF v_ref IS NOT NULL THEN
      SELECT company_id INTO v_c FROM public.labores WHERE id = v_ref;
      IF NOT FOUND OR v_c IS DISTINCT FROM v_company THEN
        RAISE EXCEPTION 'Labor % no pertenece a la empresa % (tabla %).', v_ref, v_company, TG_TABLE_NAME USING ERRCODE='42501';
      END IF;
    END IF;
    -- cuadrilla_id (miembros + labores)
    BEGIN v_ref := NULLIF(v_row ->> 'cuadrilla_id','')::UUID; EXCEPTION WHEN OTHERS THEN v_ref := NULL; END;
    IF v_ref IS NOT NULL THEN
      SELECT company_id INTO v_c FROM public.cuadrillas WHERE id = v_ref;
      IF NOT FOUND OR v_c IS DISTINCT FROM v_company THEN
        RAISE EXCEPTION 'Cuadrilla % no pertenece a la empresa % (tabla %).', v_ref, v_company, TG_TABLE_NAME USING ERRCODE='42501';
      END IF;
    END IF;
    -- curso_id
    BEGIN v_ref := NULLIF(v_row ->> 'curso_id','')::UUID; EXCEPTION WHEN OTHERS THEN v_ref := NULL; END;
    IF v_ref IS NOT NULL THEN
      SELECT company_id INTO v_c FROM public.cursos_formacion WHERE id = v_ref;
      IF NOT FOUND OR v_c IS DISTINCT FROM v_company THEN
        RAISE EXCEPTION 'Curso % no pertenece a la empresa % (tabla %).', v_ref, v_company, TG_TABLE_NAME USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['cuadrilla_miembros','labor_trabajadores','nominas','registros_formacion','labores'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS th_tenant_trg ON public.%I', t);
      EXECUTE format('CREATE TRIGGER th_tenant_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_validate_th_tenant()', t);
    END IF;
  END LOOP;
END $$;

-- ── F1.7: RBAC nóminas (salarios): escritura solo roles administrativos ───────
-- Lectura y DELETE se conservan (021 genérica + admin). Escritura exige rol.
DROP POLICY IF EXISTS nominas_insert_policy ON public.nominas;
CREATE POLICY nominas_insert_policy ON public.nominas FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company()
    AND public.current_role_id() IN ('administrador', 'gerente', 'supervisor'));
DROP POLICY IF EXISTS nominas_update_policy ON public.nominas;
CREATE POLICY nominas_update_policy ON public.nominas FOR UPDATE TO authenticated
  USING (company_id = public.current_company()
    AND public.current_role_id() IN ('administrador', 'gerente', 'supervisor'))
  WITH CHECK (company_id = public.current_company()
    AND public.current_role_id() IN ('administrador', 'gerente', 'supervisor'));

-- Recargar esquema PostgREST tras aplicar (ejecutar en Dashboard junto al archivo).
-- NOTIFY pgrst, 'reload schema';
