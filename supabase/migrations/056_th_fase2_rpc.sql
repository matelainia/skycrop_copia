-- ==============================================================================
-- SKYCROP 056: Talento Humano Fase 2 — capa RPC transaccional + storage + user_id
-- Patrón Maquinaria 052: SECURITY INVOKER + search_path + asserts tenant/rol.
-- Las RPC son la vía de escritura preferida; RLS/TRIGGERS (021/022/043/055)
-- siguen como enforcement redundante. Idempotente (CREATE OR REPLACE).
-- Aplicar en Dashboard SQL Editor + NOTIFY pgrst, 'reload schema'.
-- ==============================================================================

-- ── 0. Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.th_company()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RETURN public.current_company(); EXCEPTION WHEN OTHERS THEN RETURN NULL; END; $$;

CREATE OR REPLACE FUNCTION public.th_assert_rol(p_roles TEXT[])
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_rol TEXT;
BEGIN
  BEGIN v_rol := public.current_role_id(); EXCEPTION WHEN OTHERS THEN v_rol := 'operario'; END;
  IF v_rol = ANY (p_roles) OR v_rol IN ('administrador', 'gerente') THEN RETURN v_rol; END IF;
  RAISE EXCEPTION 'Acceso denegado: rol % sin permiso para esta operación TH.', v_rol USING ERRCODE='42501';
END; $$;

-- ── 1. Trabajador ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.th_crear_trabajador(
  p_nombres TEXT, p_apellidos TEXT, p_identificacion TEXT,
  p_tipo_contrato TEXT, p_rol TEXT, p_extra JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_id UUID;
BEGIN
  v_c := public.th_company();
  IF v_c IS NULL THEN RAISE EXCEPTION 'Sin empresa activa.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.trabajadores WHERE company_id = v_c AND identificacion = btrim(p_identificacion)) THEN
    RAISE EXCEPTION 'Ya existe un trabajador con identificación % en tu empresa.', p_identificacion USING ERRCODE='23505';
  END IF;
  INSERT INTO public.trabajadores (
    company_id, nombres, apellidos, identificacion, edad, fecha_nacimiento, fecha_contratacion,
    tipo_contrato, rh_sanguineo, tipo_eps, tipo_arl, contacto_telefonico, contacto_emergencia,
    foto, copia_contrato_name, rol, estado
  ) VALUES (
    v_c, btrim(p_nombres), btrim(p_apellidos), btrim(p_identificacion),
    NULLIF(p_extra ->> 'edad','')::INT, NULLIF(p_extra ->> 'fecha_nacimiento','')::DATE,
    COALESCE(NULLIF(p_extra ->> 'fecha_contratacion','')::DATE, CURRENT_DATE),
    p_tipo_contrato, p_extra ->> 'rh_sanguineo', p_extra ->> 'tipo_eps', p_extra ->> 'tipo_arl',
    p_extra ->> 'contacto_telefonico', p_extra ->> 'contacto_emergencia',
    p_extra ->> 'foto', p_extra ->> 'copia_contrato_name', p_rol,
    COALESCE(NULLIF(p_extra ->> 'estado',''), 'Activa')
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.th_retirar_trabajador(p_trabajador_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID;
BEGIN
  v_c := public.th_company();
  PERFORM public.th_assert_rol(ARRAY['supervisor']);
  UPDATE public.trabajadores SET estado = 'Inactivo', deleted_at = now()
  WHERE id = p_trabajador_id AND company_id = v_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado en tu empresa.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id', p_trabajador_id, 'estado', 'Inactivo');
END; $$;

CREATE OR REPLACE FUNCTION public.th_reactivar_trabajador(p_trabajador_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID;
BEGIN
  v_c := public.th_company();
  PERFORM public.th_assert_rol(ARRAY['supervisor']);
  UPDATE public.trabajadores SET estado = 'Activa', deleted_at = NULL, deleted_by = NULL
  WHERE id = p_trabajador_id AND company_id = v_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado en tu empresa.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id', p_trabajador_id, 'estado', 'Activa');
END; $$;

-- ── 2. Cuadrillas ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.th_crear_cuadrilla(p_nombre TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_id UUID;
BEGIN
  v_c := public.th_company();
  IF v_c IS NULL THEN RAISE EXCEPTION 'Sin empresa activa.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.cuadrillas (company_id, nombre) VALUES (v_c, btrim(p_nombre)) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.th_agregar_miembro(p_cuadrilla_id UUID, p_trabajador_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID;
BEGIN
  v_c := public.th_company();
  IF NOT EXISTS (SELECT 1 FROM public.cuadrillas WHERE id = p_cuadrilla_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'Cuadrilla ajena a tu empresa.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trabajadores WHERE id = p_trabajador_id AND company_id = v_c AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Trabajador ajeno o retirado.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.cuadrilla_miembros (cuadrilla_id, trabajador_id, company_id)
  VALUES (p_cuadrilla_id, p_trabajador_id, v_c) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('cuadrilla_id', p_cuadrilla_id, 'trabajador_id', p_trabajador_id);
END; $$;

-- ── 3. Labores (atómica: cabecera + miembros en una transacción) ──────────────
CREATE OR REPLACE FUNCTION public.th_registrar_labor(
  p_titulo TEXT, p_tipo TEXT, p_descripcion TEXT DEFAULT NULL,
  p_lote TEXT DEFAULT NULL, p_lote_id UUID DEFAULT NULL,
  p_fecha DATE DEFAULT CURRENT_DATE, p_estado TEXT DEFAULT 'Pendiente',
  p_asignacion TEXT DEFAULT 'individual', p_cuadrilla_id UUID DEFAULT NULL,
  p_jornal NUMERIC DEFAULT 1, p_trabajadores UUID[] DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_id UUID; v_t UUID;
BEGIN
  v_c := public.th_company();
  IF v_c IS NULL THEN RAISE EXCEPTION 'Sin empresa activa.' USING ERRCODE='42501'; END IF;
  IF p_cuadrilla_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cuadrillas WHERE id = p_cuadrilla_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'Cuadrilla ajena a tu empresa.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.labores (company_id, titulo, tipo, descripcion, lote, lote_id, fecha, estado, asignacion, cuadrilla_id, jornal)
  VALUES (v_c, btrim(p_titulo), p_tipo, p_descripcion, p_lote, p_lote_id, p_fecha, p_estado, p_asignacion, p_cuadrilla_id, p_jornal)
  RETURNING id INTO v_id;
  FOREACH v_t IN ARRAY COALESCE(p_trabajadores, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.trabajadores WHERE id = v_t AND company_id = v_c AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Trabajador % ajeno o retirado.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.labor_trabajadores (labor_id, trabajador_id, company_id)
    VALUES (v_id, v_t, v_c) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('id', v_id, 'miembros', COALESCE(array_length(p_trabajadores, 1), 0));
END; $$;

CREATE OR REPLACE FUNCTION public.th_cambiar_estado_labor(p_labor_id UUID, p_estado TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID;
BEGIN
  v_c := public.th_company();
  UPDATE public.labores SET estado = p_estado WHERE id = p_labor_id AND company_id = v_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Labor ajena a tu empresa.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id', p_labor_id, 'estado', p_estado);
END; $$;

-- ── 4. Nómina (rol administrativo exigido aquí, además de RLS 055) ────────────
CREATE OR REPLACE FUNCTION public.th_registrar_nomina(
  p_trabajador_id UUID, p_periodo TEXT, p_salario_neto NUMERIC,
  p_horas_extras NUMERIC DEFAULT 0, p_valor_hora_extra NUMERIC DEFAULT 0,
  p_retenciones NUMERIC DEFAULT 0, p_estado TEXT DEFAULT 'Procesando',
  p_fecha_pago DATE DEFAULT NULL, p_metodo_pago TEXT DEFAULT NULL, p_comentarios TEXT DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_id UUID; v_total NUMERIC;
BEGIN
  v_c := public.th_company();
  PERFORM public.th_assert_rol(ARRAY['supervisor']);
  IF NOT EXISTS (SELECT 1 FROM public.trabajadores WHERE id = p_trabajador_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'Trabajador ajeno a tu empresa.' USING ERRCODE='42501'; END IF;
  v_total := GREATEST(0, p_salario_neto + p_horas_extras * p_valor_hora_extra - p_retenciones);
  INSERT INTO public.nominas (company_id, trabajador_id, periodo, salario_neto, horas_extras, valor_hora_extra, retenciones, total_neto, estado, fecha_pago, metodo_pago, comentarios)
  VALUES (v_c, p_trabajador_id, p_periodo, p_salario_neto, p_horas_extras, p_valor_hora_extra, p_retenciones, v_total, p_estado, p_fecha_pago, p_metodo_pago, p_comentarios)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'total_neto', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.th_actualizar_nomina(
  p_nomina_id UUID, p_salario_neto NUMERIC,
  p_horas_extras NUMERIC DEFAULT 0, p_valor_hora_extra NUMERIC DEFAULT 0,
  p_retenciones NUMERIC DEFAULT 0, p_estado TEXT DEFAULT 'Procesando',
  p_fecha_pago DATE DEFAULT NULL, p_metodo_pago TEXT DEFAULT NULL, p_comentarios TEXT DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_total NUMERIC;
BEGIN
  v_c := public.th_company();
  PERFORM public.th_assert_rol(ARRAY['supervisor']);
  v_total := GREATEST(0, p_salario_neto + p_horas_extras * p_valor_hora_extra - p_retenciones);
  UPDATE public.nominas SET salario_neto = p_salario_neto, horas_extras = p_horas_extras,
    valor_hora_extra = p_valor_hora_extra, retenciones = p_retenciones, total_neto = v_total,
    estado = p_estado, fecha_pago = p_fecha_pago, metodo_pago = p_metodo_pago, comentarios = p_comentarios
  WHERE id = p_nomina_id AND company_id = v_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nómina ajena a tu empresa.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id', p_nomina_id, 'total_neto', v_total);
END; $$;

-- ── 5. Formación ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.th_crear_curso(p_nombre TEXT, p_tipo TEXT, p_horas NUMERIC DEFAULT 8)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_id UUID;
BEGIN
  v_c := public.th_company();
  IF v_c IS NULL THEN RAISE EXCEPTION 'Sin empresa activa.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.cursos_formacion (company_id, nombre, tipo, total_horas)
  VALUES (v_c, btrim(p_nombre), p_tipo, p_horas) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.th_registrar_capacitacion(
  p_trabajador_id UUID, p_curso_id UUID, p_fecha DATE,
  p_resultado TEXT, p_estado TEXT, p_certificado_url TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_c UUID; v_id UUID;
BEGIN
  v_c := public.th_company();
  IF NOT EXISTS (SELECT 1 FROM public.trabajadores WHERE id = p_trabajador_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'Trabajador ajeno a tu empresa.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cursos_formacion WHERE id = p_curso_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'Curso ajeno a tu empresa.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.registros_formacion (company_id, trabajador_id, curso_id, fecha, resultado, estado, certificado_url)
  VALUES (v_c, p_trabajador_id, p_curso_id, p_fecha, p_resultado, p_estado, p_certificado_url)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END; $$;

-- ── 6. user_id (diseño A4: 1 usuario → 0..1 trabajador por empresa) ────────────
-- Columna creada, SIN cableado UI (Fase 3: invitación/vinculación + autoservicio).
ALTER TABLE public.trabajadores
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_trabajadores_company_user') THEN
    CREATE UNIQUE INDEX uq_trabajadores_company_user
      ON public.trabajadores (company_id, user_id) WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- ── 7. Storage privado + policies por tenant ──────────────────────────────────
-- PII (fotos, contratos, certificados) no debe vivir en buckets públicos.
UPDATE storage.buckets SET public = false WHERE id IN ('trabajadores', 'certificados');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='objects') THEN
    DROP POLICY IF EXISTS th_trab_storage_select ON storage.objects;
    CREATE POLICY th_trab_storage_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id IN ('trabajadores','certificados')
        AND (storage.foldername(name))[1] = public.current_company()::text);
    DROP POLICY IF EXISTS th_trab_storage_insert ON storage.objects;
    CREATE POLICY th_trab_storage_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id IN ('trabajadores','certificados')
        AND (storage.foldername(name))[1] = public.current_company()::text);
    DROP POLICY IF EXISTS th_trab_storage_update ON storage.objects;
    CREATE POLICY th_trab_storage_update ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id IN ('trabajadores','certificados')
        AND (storage.foldername(name))[1] = public.current_company()::text)
      WITH CHECK (bucket_id IN ('trabajadores','certificados')
        AND (storage.foldername(name))[1] = public.current_company()::text);
    DROP POLICY IF EXISTS th_trab_storage_delete ON storage.objects;
    CREATE POLICY th_trab_storage_delete ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id IN ('trabajadores','certificados')
        AND (storage.foldername(name))[1] = public.current_company()::text
        AND public.current_role_id() IN ('administrador','gerente'));
  ELSE
    RAISE NOTICE '[056] omitido storage policies: esquema storage no presente';
  END IF;
END $$;

-- Recargar esquema PostgREST tras aplicar (ejecutar en Dashboard junto al archivo).
-- NOTIFY pgrst, 'reload schema';
