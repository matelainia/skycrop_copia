-- ==============================================================================
-- SKYCROP 046: Codigos atomicos (elimina MAX()+1 con raza A/B -> 105/105)
-- Estrategia: tabla contadora por (empresa, serie, ano) + upsert atomico por fila.
-- Codigo visible separado del id interno (UUID intacto). Firmas de
-- generar_codigo_* identicas para no romper llamadores (022, 042, triggers).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.codigo_contadores (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  serie TEXT NOT NULL CHECK (serie IN ('COS','PROD','VEN','DES','FAC','APL')),
  year TEXT NOT NULL,
  ultimo INT NOT NULL DEFAULT 0 CHECK (ultimo >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (company_id, serie, year)
);
ALTER TABLE public.codigo_contadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS codigo_contadores_isolate ON public.codigo_contadores;
CREATE POLICY codigo_contadores_isolate ON public.codigo_contadores FOR ALL TO authenticated
  USING (company_id = public.current_company()) WITH CHECK (company_id = public.current_company());

CREATE OR REPLACE FUNCTION public.reservar_codigo_serie(
  p_company_id UUID, p_serie TEXT, p_year TEXT, p_seed INT DEFAULT 0)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_n INT;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'company_id requerido para serie %', p_serie; END IF;
  INSERT INTO public.codigo_contadores (company_id, serie, year, ultimo)
  VALUES (p_company_id, p_serie, p_year, GREATEST(COALESCE(p_seed,0), 0))
  ON CONFLICT (company_id, serie, year) DO UPDATE
    SET ultimo = public.codigo_contadores.ultimo + 1, updated_at = timezone('utc'::text, now())
  RETURNING ultimo INTO v_n;
  -- Si la fila ya existia, el upsert sumo 1; si es nueva, ultimo = seed y hay que avanzar 1
  -- Detectamos: si seed produjo la fila, ultimo = seed -> reservamos seed+1 en segunda pasada.
  -- Simplificacion: segunda llamada atomica garantiza unicidad; el WHILE de los
  -- generadores sigue como red de seguridad ante semillas concurrentes iniciales.
  IF v_n = GREATEST(COALESCE(p_seed,0),0) AND p_seed IS NOT NULL THEN
    UPDATE public.codigo_contadores SET ultimo = ultimo + 1, updated_at = timezone('utc'::text, now())
    WHERE company_id = p_company_id AND serie = p_serie AND year = p_year
    RETURNING ultimo INTO v_n;
  END IF;
  RETURN v_n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reservar_codigo_serie(UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_codigo_serie(UUID, TEXT, TEXT, INT) TO authenticated, service_role;

-- Semilla desde el MAX existente (una vez por serie; concurrent-safe por PK + WHILE)
CREATE OR REPLACE FUNCTION public.generar_codigo_cosecha(p_company_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM COALESCE(p_fecha, CURRENT_DATE))::TEXT;
  v_seed INT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo, '^COS-'||v_year||'-(\d+)$'))[1]::INT), 0)
    INTO v_seed FROM public.cosechas WHERE company_id = p_company_id AND codigo LIKE 'COS-'||v_year||'-%';
  v_seq := public.reservar_codigo_serie(p_company_id, 'COS', v_year, COALESCE(v_seed,0));
  v_code := 'COS-'||v_year||'-'||LPAD(v_seq::TEXT, 6, '0');
  WHILE EXISTS (SELECT 1 FROM public.cosechas WHERE company_id = p_company_id AND codigo = v_code) LOOP
    v_seq := public.reservar_codigo_serie(p_company_id, 'COS', v_year, 0);
    v_code := 'COS-'||v_year||'-'||LPAD(v_seq::TEXT, 6, '0');
  END LOOP;
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.generar_codigo_producto(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seed INT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo, '^PROD-'||v_year||'-(\d+)$'))[1]::INT), 0)
    INTO v_seed FROM public.lotes_producto WHERE company_id=p_company_id AND codigo LIKE 'PROD-'||v_year||'-%';
  v_seq := public.reservar_codigo_serie(p_company_id, 'PROD', v_year, COALESCE(v_seed,0));
  v_code := 'PROD-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.lotes_producto WHERE company_id=p_company_id AND codigo=v_code) LOOP
    v_seq := public.reservar_codigo_serie(p_company_id, 'PROD', v_year, 0);
    v_code := 'PROD-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  END LOOP;
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.generar_codigo_venta(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seed INT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo,'^VEN-'||v_year||'-(\d+)$'))[1]::INT),0)
    INTO v_seed FROM public.ventas WHERE company_id=p_company_id AND codigo LIKE 'VEN-'||v_year||'-%';
  v_seq := public.reservar_codigo_serie(p_company_id, 'VEN', v_year, COALESCE(v_seed,0));
  v_code := 'VEN-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.ventas WHERE company_id=p_company_id AND codigo=v_code) LOOP
    v_seq := public.reservar_codigo_serie(p_company_id, 'VEN', v_year, 0);
    v_code := 'VEN-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  END LOOP;
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.generar_codigo_despacho(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seed INT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo,'^DES-'||v_year||'-(\d+)$'))[1]::INT),0)
    INTO v_seed FROM public.despachos WHERE company_id=p_company_id AND codigo LIKE 'DES-'||v_year||'-%';
  v_seq := public.reservar_codigo_serie(p_company_id, 'DES', v_year, COALESCE(v_seed,0));
  v_code := 'DES-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.despachos WHERE company_id=p_company_id AND codigo=v_code) LOOP
    v_seq := public.reservar_codigo_serie(p_company_id, 'DES', v_year, 0);
    v_code := 'DES-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  END LOOP;
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.generar_codigo_factura(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seed INT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo,'^FAC-'||v_year||'-(\d+)$'))[1]::INT),0)
    INTO v_seed FROM public.facturas WHERE company_id=p_company_id AND codigo LIKE 'FAC-'||v_year||'-%';
  v_seq := public.reservar_codigo_serie(p_company_id, 'FAC', v_year, COALESCE(v_seed,0));
  v_code := 'FAC-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.facturas WHERE company_id=p_company_id AND codigo=v_code) LOOP
    v_seq := public.reservar_codigo_serie(p_company_id, 'FAC', v_year, 0);
    v_code := 'FAC-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  END LOOP;
  RETURN v_code;
END; $$;

-- APL-00001: antes COUNT(*) global sin ano; se conserva formato pero atomico por empresa
CREATE OR REPLACE FUNCTION public.generar_codigo_apl(p_lote_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_company_id UUID; v_count INT; v_seq INT; v_codigo TEXT;
BEGIN
  SELECT company_id INTO v_company_id FROM public.lotes WHERE id = p_lote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no encontrado.'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.aplicaciones WHERE company_id = v_company_id;
  v_seq := public.reservar_codigo_serie(v_company_id, 'APL', 'GLOBAL', COALESCE(v_count,0));
  v_codigo := 'APL-' || LPAD(v_seq::text, 5, '0');
  WHILE EXISTS (SELECT 1 FROM public.aplicaciones WHERE company_id = v_company_id AND codigo_apl = v_codigo) LOOP
    v_seq := public.reservar_codigo_serie(v_company_id, 'APL', 'GLOBAL', 0);
    v_codigo := 'APL-' || LPAD(v_seq::text, 5, '0');
  END LOOP;
  RETURN v_codigo;
END; $$;
