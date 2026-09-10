-- ==============================================================================
-- SKYCROP DATABASE V2: 037_security_hardening.sql
-- Descripción: Endurecimiento de funciones SECURITY DEFINER contra suplantación
-- de identidad cross-tenant (IDOR/escalamiento vía RPC).
--
-- ESTRATEGIA (cero ruptura funcional):
--   Las RPCs legítimas del backend se llaman SIN JWT de usuario (clave interna)
--   o con rol service_role: en ambos casos el comportamiento NO cambia.
--   Cuando la llamada llega con un JWT de usuario autenticado (p. ej. desde el
--   navegador), ahora SE EXIGE que:
--     a) bootstrap_user_org: el sub del JWT coincida con p_user_id
--        (nadie puede crear membresías para terceros).
--     b) Funciones con p_company_id: el llamante debe ser miembro activo de esa
--        empresa (tabla company_users).
--
-- NOTA POST-ROTACIÓN: cuando SUPABASE_SERVICE_ROLE_KEY sea una clave real
-- (service_role), las llamadas internas del backend entran por la rama
-- service_role y se podrá restringir aún más (bloqueando también al rol anónimo).
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: verificación de pertenencia al tenant para RPCs
-- Comportamiento: no-op si no hay JWT (llamada interna) o si el rol es
-- service_role; en caso contrario exige membresía activa en company_users.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_assert_tenant_access(
  p_company_id UUID,
  p_user_id    TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_claims TEXT;
  v_role   TEXT;
  v_sub    TEXT;
BEGIN
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Sin claims → llamada interna del backend (sin JWT): permitir (compatibilidad)
  IF v_claims IS NULL THEN
    RETURN;
  END IF;

  v_claims := v_claims::jsonb;
  v_role   := v_claims->>'role';

  -- El rol de servicio es de confianza total (bypass intencional)
  IF v_role = 'service_role' THEN
    RETURN;
  END IF;

  v_sub := v_claims->>'sub';

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      AND cu.clerk_user_id = COALESCE(p_user_id, v_sub)
      AND COALESCE(cu.activo, true) = true
  ) THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: el usuario % no pertenece a la empresa %',
      v_sub, p_company_id
      USING ERRCODE = '42501';
  END IF;
END
$fn$;

COMMENT ON FUNCTION public.rpc_assert_tenant_access IS
  'Guard anti-IDOR para RPCs SECURITY DEFINER: valida membresía del JWT contra company_users. No-op para llamadas internas sin JWT y para service_role.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1/5 bootstrap_user_org — bloquea crear/perfil/membresía de OTRO usuario
-- (fuente: 025_bootstrap.sql; cuerpo idéntico + guard)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bootstrap_user_org(
  p_user_id      TEXT,
  p_email        TEXT,
  p_nombre       TEXT,
  p_apellido     TEXT,
  p_clerk_org_id TEXT,
  p_org_nombre   TEXT,
  p_org_slug     TEXT,
  p_org_logo     TEXT,
  p_role_id      TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_lote_count  INTEGER;
  v_claims      TEXT;
BEGIN
  -- GUARD anti-suplantación: con JWT autenticado, solo se puede auto-provisionar.
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');
  IF v_claims IS NOT NULL THEN
    IF (v_claims::jsonb)->>'role' IS DISTINCT FROM 'service_role'
       AND (v_claims::jsonb)->>'sub' IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'ACCESO_DENEGADO: no se puede aprovisionar otro usuario (sub=%)',
        (v_claims::jsonb)->>'sub'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ── PASO 1: Upsert perfil de usuario ──────────────────────────────────────
  INSERT INTO public.profiles (id, email, nombre, apellido, updated_at)
  VALUES (p_user_id, p_email, p_nombre, p_apellido, now())
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    nombre    = COALESCE(NULLIF(EXCLUDED.nombre, ''),   public.profiles.nombre),
    apellido  = COALESCE(NULLIF(EXCLUDED.apellido, ''), public.profiles.apellido),
    updated_at = now();

  -- ── PASO 2: Upsert empresa ────────────────────────────────────────────────
  INSERT INTO public.companies (clerk_org_id, nombre, slug, logo, estado, updated_at)
  VALUES (p_clerk_org_id, p_org_nombre, p_org_slug, p_org_logo, 'active', now())
  ON CONFLICT (clerk_org_id) DO UPDATE SET
    nombre     = EXCLUDED.nombre,
    updated_at = now()
  RETURNING id INTO v_company_id;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE clerk_org_id = p_clerk_org_id;
  END IF;

  -- ── PASO 3: Lote por defecto (solo si la empresa no tiene ninguno) ─────────
  SELECT COUNT(*) INTO v_lote_count
  FROM public.lotes
  WHERE company_id = v_company_id;

  IF v_lote_count = 0 THEN
    INSERT INTO public.lotes (
      company_id, codigo_interno, nombre, cultivo,
      centroide_lat, centroide_lng, area_ha
    )
    VALUES (
      v_company_id, 'LM', 'Las Margaritas', 'Café',
      4.1234, -73.6543, 15.5
    )
    ON CONFLICT (company_id, codigo_interno) DO NOTHING;
  END IF;

  -- ── PASO 4: Upsert membresía de usuario ───────────────────────────────────
  INSERT INTO public.company_users (
    company_id, clerk_user_id, role_id, activo, status, updated_at
  )
  VALUES (v_company_id, p_user_id, p_role_id, true, 'active', now())
  ON CONFLICT (company_id, clerk_user_id) DO UPDATE SET
    updated_at = now();

  -- ── RETORNO ───────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'company_id', v_company_id,
    'user_id',    p_user_id,
    'role_id',    p_role_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'bootstrap_user_org falló [user: %, org: %]: % %',
    p_user_id, p_clerk_org_id, SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_user_org IS
  'Aprovisionamiento atómico e idempotente (025). Endurecido en 037: con JWT autenticado solo se permite auto-provisionamiento (sub = p_user_id).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2/5 registrar_costo_lote — exigir membresía de p_company_id (fuente: 022)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_costo_lote(
  p_company_id      UUID,
  p_lote_id         UUID,
  p_concepto        TEXT,
  p_costo           NUMERIC,
  p_fecha           DATE,
  p_referencia_tipo TEXT,
  p_referencia_id   UUID,
  p_observaciones   TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_costo_id UUID;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id);

  INSERT INTO public.costos (
    company_id, lote_id, concepto, costo, fecha, referencia_tipo, referencia_id, observaciones
  ) VALUES (
    p_company_id, p_lote_id, p_concepto, p_costo, p_fecha, p_referencia_tipo, p_referencia_id, p_observaciones
  ) RETURNING id INTO v_costo_id;

  RETURN v_costo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3/5 registrar_historial_actividad — exigir membresía de p_company_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_historial_actividad(
  p_company_id     UUID,
  p_lote_id        UUID,
  p_tipo_actividad TEXT,
  p_responsable    TEXT,
  p_observaciones  TEXT,
  p_resultados     TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_actividad_id UUID;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id);

  INSERT INTO public.historial_actividades (
    company_id, lote_id, tipo_actividad, fecha_actividad, responsable, observaciones, resultados
  ) VALUES (
    p_company_id, p_lote_id, p_tipo_actividad, now(), p_responsable, p_observaciones, p_resultados
  ) RETURNING id INTO v_actividad_id;

  RETURN v_actividad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4/5 consumir_inventario_por_aplicacion — exigir membresía de p_company_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consumir_inventario_por_aplicacion(
  p_company_id     UUID,
  p_item_id        UUID,
  p_cantidad       NUMERIC,
  p_usuario_id     TEXT,
  p_warehouse_id   UUID,
  p_lote_id        UUID,
  p_referencia_id  UUID
) RETURNS JSONB AS $$
DECLARE
  v_antes NUMERIC;
  v_despues NUMERIC;
  v_item_name TEXT;
  v_min_qty NUMERIC;
  v_unit TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_usuario_id);

  SELECT quantity, name, min_quantity, unit INTO v_antes, v_item_name, v_min_qty, v_unit
  FROM public.inventario
  WHERE id = p_item_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artículo no encontrado en el inventario.';
  END IF;

  IF v_antes < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para %: solicitado %, disponible %.', v_item_name, p_cantidad, v_antes;
  END IF;

  v_despues := v_antes - p_cantidad;

  UPDATE public.inventario
  SET quantity = v_despues
  WHERE id = p_item_id;

  INSERT INTO public.movimientos_inventario (
    company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id
  ) VALUES (
    p_company_id, p_item_id, p_cantidad, 'salida', v_antes, v_despues, 'Consumo en Aplicación Agrícola', p_usuario_id, p_warehouse_id
  );

  IF v_despues < v_min_qty THEN
    INSERT INTO public.alertas (company_id, tipo, mensaje)
    VALUES (
      p_company_id,
      'STOCK_MINIMO',
      'Alerta: El stock de ' || v_item_name || ' (' || v_despues || ' ' || v_unit || ') es inferior al mínimo de ' || v_min_qty || ' ' || v_unit || '.'
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'antes', v_antes,
    'despues', v_despues,
    'item', v_item_name
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5/5 guardar_evaluacion_completa — exigir membresía de p_company_id (fuente: 028)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_evaluacion_completa(
    p_company_id            UUID,
    p_lote_id               UUID,
    p_objeto_evaluacion_id  UUID,
    p_protocolo_version_id  UUID,
    p_tipo_monitoreo        VARCHAR,
    p_responsable           VARCHAR,
    p_valores_evaluacion    JSONB,
    p_incidencia_pct        DOUBLE PRECISION,
    p_severidad_pct         DOUBLE PRECISION,
    p_humedad_pct           DOUBLE PRECISION,
    p_temperatura_c         DOUBLE PRECISION,
    p_plagas_detectadas     TEXT,
    p_enfermedades_detectadas TEXT,
    p_observaciones         TEXT,
    p_user_id               TEXT,
    p_estado_sanitario      VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mon_id UUID;
    v_current_ndvi DOUBLE PRECISION;
    v_next_ndvi DOUBLE PRECISION;
    v_ndvi_change DOUBLE PRECISION;
BEGIN
    PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);

    INSERT INTO public.monitoreos (
        company_id,
        lote_id,
        objeto_evaluacion_id,
        protocolo_version_id,
        tipo_monitoreo,
        fecha_monitoreo,
        responsable,
        valores_evaluacion,
        incidencia_pct,
        severidad_pct,
        humedad_pct,
        temperatura_c,
        plagas_detectadas,
        enfermedades_detectadas,
        observaciones
    ) VALUES (
        p_company_id,
        p_lote_id,
        p_objeto_evaluacion_id,
        p_protocolo_version_id,
        p_tipo_monitoreo,
        now(),
        p_responsable,
        p_valores_evaluacion,
        p_incidencia_pct,
        p_severidad_pct,
        p_humedad_pct,
        p_temperatura_c,
        p_plagas_detectadas,
        p_enfermedades_detectadas,
        p_observaciones
    )
    RETURNING id INTO v_mon_id;

    SELECT ndvi_actual INTO v_current_ndvi FROM public.lotes WHERE id = p_lote_id;
    v_ndvi_change := p_severidad_pct / 100.0;
    v_next_ndvi := COALESCE(v_current_ndvi, 0.75) - v_ndvi_change;
    IF v_next_ndvi < 0.15 THEN
        v_next_ndvi := 0.15;
    END IF;

    UPDATE public.lotes
    SET
        estado_sanitario = p_estado_sanitario,
        ndvi_actual = v_next_ndvi,
        updated_at = now()
    WHERE id = p_lote_id;

    DELETE FROM public.draft_evaluaciones
    WHERE company_id = p_company_id
      AND user_id = p_user_id
      AND lote_id = p_lote_id;

    INSERT INTO public.audit_logs (
        company_id,
        usuario_id,
        accion,
        tabla,
        registro_id,
        detalles
    ) VALUES (
        p_company_id,
        p_user_id,
        'CREATE_EVALUATION',
        'monitoreos',
        v_mon_id,
        json_build_object(
            'lote_id', p_lote_id,
            'objeto_evaluacion_id', p_objeto_evaluacion_id,
            'incidencia_pct', p_incidencia_pct,
            'severidad_pct', p_severidad_pct,
            'estado_sanitario', p_estado_sanitario
        )
    );

    RETURN v_mon_id;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Rollback ejecutado. Error al guardar evaluación: % (Estado: %)', SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.guardar_evaluacion_completa IS
  'Persistencia atómica de evaluación (028). Endurecido en 037: exige membresía del llamante en p_company_id cuando hay JWT autenticado.';
