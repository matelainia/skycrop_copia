-- ==============================================================================
-- SKYCROP 049: Soporte E2E aislado (TEST/STAGING, jamás producción con mocks)
-- - NO inserta datos mock. Solo funciones de verificación + limpieza controlada.
-- - Convención: todo registro sintético lleva metadata.test_run_id = 'E2E-YYYY-MM-DD-NNN'.
-- - Limpieza borra SOLO filas con ese test_run_id; audit_logs se retiene.
-- - Verificación compara conteos operacional vs auditoría vs trazabilidad.
-- ==============================================================================

-- Limpieza controlada por TEST_RUN_ID (solo tablas con columna metadata jsonb).
CREATE OR REPLACE FUNCTION public.e2e_cleanup_test_run(p_test_run_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_out JSONB := '{}'::jsonb; v_n INT;
BEGIN
  IF p_test_run_id IS NULL OR p_test_run_id NOT LIKE 'E2E-%' THEN
    RAISE EXCEPTION 'p_test_run_id inválido (formato E2E-YYYY-MM-DD-NNN): %', p_test_run_id;
  END IF;
  -- Tablas operacionales con metadata (idempotente por tabla).
  FOR v_n IN SELECT 1 LOOP EXIT; END LOOP; -- placeholder para estructura
  BEGIN DELETE FROM public.traceability_events WHERE metadata->>'test_run_id' = p_test_run_id; GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('traceability_events', v_n); EXCEPTION WHEN OTHERS THEN v_out := v_out || jsonb_build_object('traceability_events', 'SKIP:'||SQLERRM); END;
  BEGIN DELETE FROM public.cosechas WHERE metadata->>'test_run_id' = p_test_run_id; GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('cosechas', v_n); EXCEPTION WHEN OTHERS THEN v_out := v_out || jsonb_build_object('cosechas', 'SKIP:'||SQLERRM); END;
  BEGIN DELETE FROM public.monitoreos WHERE (metadata->>'test_run_id') = p_test_run_id; GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('monitoreos', v_n); EXCEPTION WHEN OTHERS THEN v_out := v_out || jsonb_build_object('monitoreos', 'SKIP:'||SQLERRM); END;
  BEGIN DELETE FROM public.aplicaciones WHERE (metadata->>'test_run_id') = p_test_run_id; GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('aplicaciones', v_n); EXCEPTION WHEN OTHERS THEN v_out := v_out || jsonb_build_object('aplicaciones', 'SKIP:'||SQLERRM); END;
  -- Nota deliberada: audit_logs NO se borra aquí (evidencia temporal para investigar fallas).
  -- Las companies E2E se borran por nombre prefijado desde el runner (CASCADE cubre predios/lotes).
  RETURN jsonb_build_object('test_run_id', p_test_run_id, 'deleted', v_out, 'retained', jsonb_build_array('audit_logs', 'reports'));
END; $$;
REVOKE EXECUTE ON FUNCTION public.e2e_cleanup_test_run(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.e2e_cleanup_test_run(TEXT) TO service_role;

-- Verificación de cadena de evidencia por TEST_RUN_ID.
CREATE OR REPLACE FUNCTION public.e2e_verify_evidence_chain(p_test_run_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_trz INT := 0; v_audit INT := 0;
BEGIN
  IF p_test_run_id IS NULL OR p_test_run_id NOT LIKE 'E2E-%' THEN
    RAISE EXCEPTION 'p_test_run_id inválido: %', p_test_run_id;
  END IF;
  BEGIN SELECT count(*) INTO v_trz FROM public.traceability_events WHERE metadata->>'test_run_id' = p_test_run_id; EXCEPTION WHEN OTHERS THEN v_trz := -1; END;
  BEGIN SELECT count(*) INTO v_audit FROM public.audit_logs WHERE metadata->>'test_run_id' = p_test_run_id OR despues::text LIKE '%'||p_test_run_id||'%'; EXCEPTION WHEN OTHERS THEN v_audit := -1; END;
  RETURN jsonb_build_object(
    'test_run_id', p_test_run_id,
    'traceability', v_trz,
    'audit', v_audit,
    'consistent', (v_trz >= 0 AND v_audit >= 0 AND v_audit >= v_trz),
    'checked_at', timezone('utc'::text, now()));
END; $$;
REVOKE EXECUTE ON FUNCTION public.e2e_verify_evidence_chain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.e2e_verify_evidence_chain(TEXT) TO authenticated, service_role;
