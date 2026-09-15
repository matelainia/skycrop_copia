-- ==============================================================================
-- SKYCROP DATABASE V2: 053_maquinaria_legacy_sync.sql
-- Puente de compatibilidad legacy ↔ canónico para public.maquinaria.
-- Contexto: el frontend actual escribe columnas legacy (codigo_id, name, status)
-- vía PostgREST directo; 052 declaró codigo/nombre/estado/horometro_actual NOT
-- NULL. Sin este puente, la regresión del módulo existente falla (paso 7).
-- Regla: en INSERT/UPDATE, el lado modificado manda; en conflicto, el canónico
-- gana; el alias 'En mantenimiento' (frontend actual) mapea a 'Mantenimiento'.
-- No elimina nada legacy. Idempotente. Solo staging hasta puerta en verde.
-- ==============================================================================

-- 053-00 PRECONDITIONS (052 debe estar aplicada).
DO $pre$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='maquinaria' AND column_name='codigo') THEN
    RAISE EXCEPTION '053-00 ABORT: falta maquinaria.codigo — aplicar 052 completa antes';
  END IF;
  RAISE NOTICE '[053-00] OK: 052 presente.';
END $pre$;

-- 053-01 Función unificada + reemplazo de triggers parciales de 052.
CREATE OR REPLACE FUNCTION public.mq_sync_legacy()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_est TEXT;
BEGIN
  -- Pares legacy ↔ canónico (rellena el ausente; neutros donde no hay contraparte).
  IF NEW.codigo IS NULL THEN NEW.codigo := upper(btrim(NEW.codigo_id)); END IF;
  IF NEW.codigo_id IS NULL THEN NEW.codigo_id := NEW.codigo; END IF;
  IF NEW.nombre IS NULL THEN NEW.nombre := NEW.name; END IF;
  IF NEW.name IS NULL THEN NEW.name := NEW.nombre; END IF;
  IF NEW.tipo IS NULL THEN
    NEW.tipo := CASE WHEN NEW.type IN
      ('Tractor','Cosechadora','Pulverizadora','Implemento','Camion','Vehiculo','Motocultor','Otro')
      THEN NEW.type ELSE 'Otro' END;
  END IF;
  IF NEW.type IS NULL THEN NEW.type := NEW.tipo; END IF;
  IF NEW.horometro_actual IS NULL THEN NEW.horometro_actual := COALESCE(NEW.hours_of_operation, 0); END IF;
  IF NEW.hours_of_operation IS NULL THEN NEW.hours_of_operation := COALESCE(NEW.horometro_actual, 0); END IF;
  IF NEW.hours_today IS NULL THEN NEW.hours_today := 0; END IF;
  IF NEW.next_maintenance_hours IS NULL THEN NEW.next_maintenance_hours := 0; END IF;
  IF NEW.fuel_consumption IS NULL THEN NEW.fuel_consumption := '0 L/h'; END IF;
  IF NEW.costo_operador_hora IS NULL THEN NEW.costo_operador_hora := COALESCE(NEW.cost_operator, 0); END IF;
  IF NEW.cost_operator IS NULL THEN NEW.cost_operator := COALESCE(NEW.costo_operador_hora, 0); END IF;
  IF NEW.costo_combustible_hora IS NULL THEN NEW.costo_combustible_hora := COALESCE(NEW.cost_fuel, 0); END IF;
  IF NEW.cost_fuel IS NULL THEN NEW.cost_fuel := COALESCE(NEW.costo_combustible_hora, 0); END IF;
  IF NEW.costo_mantenimiento_hora IS NULL THEN NEW.costo_mantenimiento_hora := COALESCE(NEW.cost_maintenance, 0); END IF;
  IF NEW.cost_maintenance IS NULL THEN NEW.cost_maintenance := COALESCE(NEW.costo_mantenimiento_hora, 0); END IF;
  IF NEW.costo_depreciacion_hora IS NULL THEN NEW.costo_depreciacion_hora := COALESCE(NEW.cost_depreciation, 0); END IF;
  IF NEW.cost_depreciation IS NULL THEN NEW.cost_depreciation := COALESCE(NEW.costo_depreciacion_hora, 0); END IF;
  IF NEW.image_url IS NULL THEN NEW.image_url := NEW.photo_url; END IF;
  IF NEW.photo_url IS NULL THEN NEW.photo_url := NEW.image_url; END IF;

  -- estado/status: el lado modificado manda; en conflicto, el canónico gana.
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado IN ('Disponible','Operando','Mantenimiento','Fuera de servicio')
       AND (NEW.status IS NULL OR NEW.status = CASE NEW.estado
         WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
         WHEN 'Mantenimiento' THEN 'Mantenimiento' ELSE 'Fuera de Servicio' END
         OR (NEW.estado = 'Mantenimiento' AND NEW.status = 'En mantenimiento')) THEN
      v_est := NEW.estado;
    ELSE
      v_est := CASE NEW.status
        WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
        WHEN 'Mantenimiento' THEN 'Mantenimiento' WHEN 'Fuera de Servicio' THEN 'Fuera de servicio'
        WHEN 'En mantenimiento' THEN 'Mantenimiento'
        ELSE 'Disponible' END;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
        AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    v_est := CASE NEW.status
      WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
      WHEN 'Mantenimiento' THEN 'Mantenimiento' WHEN 'Fuera de Servicio' THEN 'Fuera de servicio'
      WHEN 'En mantenimiento' THEN 'Mantenimiento'
      ELSE OLD.estado END;
  ELSIF NEW.estado IN ('Disponible','Operando','Mantenimiento','Fuera de servicio') THEN
    v_est := NEW.estado;
  ELSE
    v_est := CASE NEW.status
      WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
      WHEN 'Mantenimiento' THEN 'Mantenimiento' WHEN 'Fuera de Servicio' THEN 'Fuera de servicio'
      WHEN 'En mantenimiento' THEN 'Mantenimiento'
      ELSE OLD.estado END;
  END IF;
  NEW.estado := v_est;
  NEW.status := CASE v_est WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
    WHEN 'Mantenimiento' THEN 'Mantenimiento' ELSE 'Fuera de Servicio' END;

  -- Transiciones válidas (contrato §3), evaluadas post-sincronía.
  IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    IF NOT (
      (OLD.estado = 'Disponible' AND NEW.estado IN ('Operando','Mantenimiento','Fuera de servicio')) OR
      (OLD.estado = 'Operando' AND NEW.estado = 'Disponible') OR
      (OLD.estado = 'Mantenimiento' AND NEW.estado IN ('Disponible','Fuera de servicio')) OR
      (OLD.estado = 'Fuera de servicio' AND NEW.estado = 'Disponible')) THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO: transición % → % no permitida', OLD.estado, NEW.estado;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $fn$;

-- Reemplaza los dos triggers parciales de 052 (validación pre-sync + sync solo UPDATE).
DROP TRIGGER IF EXISTS mq_estado_trg ON public.maquinaria;
DROP TRIGGER IF EXISTS mq_sync_status_trg ON public.maquinaria;
DROP TRIGGER IF EXISTS mq_sync_legacy_trg ON public.maquinaria;
CREATE TRIGGER mq_sync_legacy_trg BEFORE INSERT OR UPDATE ON public.maquinaria
  FOR EACH ROW EXECUTE FUNCTION public.mq_sync_legacy();

-- 053-02 Normaliza filas existentes a través del puente (sin cambiar valores).
UPDATE public.maquinaria SET codigo_id = codigo_id
WHERE codigo IS NULL OR nombre IS NULL OR estado IS NULL OR horometro_actual IS NULL
   OR tipo IS NULL OR costo_operador_hora IS NULL;

-- 053-03 Postflight.
DO $post$ DECLARE v_n INT; BEGIN
  PERFORM 1 FROM pg_trigger WHERE tgname = 'mq_sync_legacy_trg';
  IF NOT FOUND THEN RAISE EXCEPTION '053-03 FAIL: mq_sync_legacy_trg no creado'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname IN ('mq_estado_trg','mq_sync_status_trg');
  IF FOUND THEN RAISE EXCEPTION '053-03 FAIL: triggers parciales 052 siguen activos'; END IF;
  SELECT count(*) INTO v_n FROM public.maquinaria
  WHERE codigo IS NULL OR nombre IS NULL OR estado IS NULL OR horometro_actual IS NULL;
  IF v_n > 0 THEN RAISE EXCEPTION '053-03 FAIL: % filas sin canónico (codigo/nombre obligatorios)', v_n; END IF;
  RAISE NOTICE '[053-03] OK: puente activo, triggers parciales retirados.';
END $post$;

-- ROLLBACK: DROP TRIGGER mq_sync_legacy_trg; DROP FUNCTION mq_sync_legacy();
-- recrear mq_estado_trg + mq_sync_status_trg desde 052-09 si se revierte.
