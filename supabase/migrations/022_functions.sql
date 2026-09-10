-- ==============================================================================
-- SKYCROP DATABASE V2: 022_functions.sql
-- Descripción: Funciones de Negocio, Triggers de Automatización y RPCs
-- ==============================================================================

-- 0. Tabla de Alertas de Negocio (Requerida para las automatizaciones de stock y carencia)
CREATE TABLE IF NOT EXISTS public.alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- e.g. 'STOCK_MINIMO', 'PERIODO_CARENCIA'
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY alertas_select_policy ON public.alertas FOR SELECT TO authenticated USING (company_id = public.current_company());
CREATE POLICY alertas_update_policy ON public.alertas FOR UPDATE TO authenticated USING (company_id = public.current_company());


-- 1. TRIGGERS DE SEGURIDAD Y VALIDACIÓN DE INQUILINO (ZERO-TRUST)

-- 1.1 Trigger para autocompletar y proteger company_id
CREATE OR REPLACE FUNCTION public.process_secure_company_id() RETURNS TRIGGER AS $$
DECLARE
  v_current_company UUID;
BEGIN
  v_current_company := public.current_company();
  
  -- Autocompletar company_id en INSERT si viene nulo
  IF (TG_OP = 'INSERT') THEN
    IF NEW.company_id IS NULL THEN
      NEW.company_id := v_current_company;
    END IF;
  END IF;
  
  -- Evitar suplantación de company_id para usuarios autenticados
  IF (auth.role() = 'authenticated') THEN
    IF NEW.company_id <> v_current_company THEN
      INSERT INTO public.security_events (usuario_id, company_id, accion, tabla, registro_id, resultado)
      VALUES (public.current_user_id(), v_current_company, 'FORGERY_ATTEMPT', TG_TABLE_NAME, NEW.id, 'BLOCKED');
      
      RAISE EXCEPTION 'Acceso denegado: intento de falsificación de company_id en la tabla %.', TG_TABLE_NAME;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enlazar trigger secure_company_id_trg a todas las tablas del tenant (excepto tablas de auditoría recursivas)
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'predios', 'lotes', 'trabajadores', 'cuadrillas', 'cuadrilla_miembros', 
    'bodegas', 'almacenamientos', 'inventario', 'movimientos_inventario', 
    'labores', 'labor_trabajadores', 'planificacion_cosechas', 
    'aplicaciones', 'cosechas', 'maquinaria', 'jornadas_maquinaria', 
    'historial_actividades', 'monitoreos', 'cursos_formacion', 
    'registros_formacion', 'nominas', 'costos', 'alertas'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS secure_company_id_trg ON public.%I', t_name);
    EXECUTE format('CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id()', t_name);
  END LOOP;
END $$;


-- 1.2 Trigger para autogenerar Predio si lote_id se crea sin predio
CREATE OR REPLACE FUNCTION public.process_auto_predio() RETURNS TRIGGER AS $$
DECLARE
  v_predio_id UUID;
BEGIN
  IF NEW.predio_id IS NULL THEN
    -- Buscar si ya existe un predio por defecto para esta compañía
    SELECT id INTO v_predio_id 
    FROM public.predios 
    WHERE company_id = NEW.company_id 
    LIMIT 1;
    
    -- Si no existe, crearlo
    IF v_predio_id IS NULL THEN
      INSERT INTO public.predios (company_id, nombre, ubicacion, area_total_ha)
      VALUES (NEW.company_id, 'Predio Principal', 'Ubicación General', NEW.area_ha)
      RETURNING id INTO v_predio_id;
    END IF;
    
    NEW.predio_id := v_predio_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_predio_lotes_trg ON public.lotes;
CREATE TRIGGER auto_predio_lotes_trg 
  BEFORE INSERT ON public.lotes 
  FOR EACH ROW EXECUTE FUNCTION public.process_auto_predio();


-- 2. SERVICIOS DE INTEGRACIÓN ENTRE DOMINIOS (BUSINESS LOGIC LAYER)

-- 2.1 Servicio de Registro de Costos Unificado
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
  INSERT INTO public.costos (
    company_id, lote_id, concepto, costo, fecha, referencia_tipo, referencia_id, observaciones
  ) VALUES (
    p_company_id, p_lote_id, p_concepto, p_costo, p_fecha, p_referencia_tipo, p_referencia_id, p_observaciones
  ) RETURNING id INTO v_costo_id;
  
  RETURN v_costo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.2 Servicio de Historial de Lote (Timeline)
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
  INSERT INTO public.historial_actividades (
    company_id, lote_id, tipo_actividad, fecha_actividad, responsable, observaciones, resultados
  ) VALUES (
    p_company_id, p_lote_id, p_tipo_actividad, now(), p_responsable, p_observaciones, p_resultados
  ) RETURNING id INTO v_actividad_id;
  
  RETURN v_actividad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.3 Servicio Completo de Consumo de Inventario por Aplicaciones
CREATE OR REPLACE FUNCTION public.consumir_inventario_por_aplicacion(
  p_company_id     UUID,
  p_item_id        UUID,
  p_cantidad       NUMERIC,
  p_usuario_id     TEXT,
  p_warehouse_id   UUID,
  p_lote_id        UUID,
  p_referencia_id  UUID -- ID de la Aplicación
) RETURNS JSONB AS $$
DECLARE
  v_antes NUMERIC;
  v_despues NUMERIC;
  v_item_name TEXT;
  v_min_qty NUMERIC;
  v_unit TEXT;
  v_result JSONB;
BEGIN
  -- 1. Consultar existencias actuales
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
  
  -- 2. Actualizar Inventario
  UPDATE public.inventario
  SET quantity = v_despues
  WHERE id = p_item_id;
  
  -- 3. Registrar Movimiento Kardex
  INSERT INTO public.movimientos_inventario (
    company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id
  ) VALUES (
    p_company_id, p_item_id, p_cantidad, 'salida', v_antes, v_despues, 'Consumo en Aplicación Agrícola', p_usuario_id, p_warehouse_id
  );
  
  -- 4. Evaluar alerta de stock mínimo
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


-- 3. TRIGGERS DE AUTOMATIZACIÓN DE NEGOCIO

-- 3.1 Trigger de Alertas y Actualizaciones de Carencia en Lotes al insertar Aplicación Fitosanitaria
CREATE OR REPLACE FUNCTION public.process_carencia_aplicacion() RETURNS TRIGGER AS $$
DECLARE
  v_lote_name TEXT;
  v_fecha_fin TIMESTAMP WITH TIME ZONE;
BEGIN
  IF NEW.periodo_carencia_dias > 0 THEN
    v_fecha_fin := NEW.fecha_aplicacion + (NEW.periodo_carencia_dias || ' days')::interval;
    
    -- Actualizar el estado de carencia en el lote
    UPDATE public.lotes
    SET 
      carencia_activa = true,
      fecha_fin_carencia = v_fecha_fin,
      producto_carencia = NEW.producto_comercial,
      estado_sanitario = 'bajo' -- Estado provisional durante el periodo de carencia
    WHERE id = NEW.lote_id;
    
    SELECT nombre INTO v_lote_name FROM public.lotes WHERE id = NEW.lote_id;
    
    -- Generar la alerta de carencia
    INSERT INTO public.alertas (company_id, tipo, mensaje)
    VALUES (
      NEW.company_id,
      'PERIODO_CARENCIA',
      'El lote "' || COALESCE(v_lote_name, 'Desconocido') || '" ha entrado en periodo de carencia por ' || NEW.producto_comercial || ' hasta ' || to_char(v_fecha_fin, 'YYYY-MM-DD HH:MI AM') || '.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS carencia_aplicaciones_trg ON public.aplicaciones;
CREATE TRIGGER carencia_aplicaciones_trg 
  AFTER INSERT OR UPDATE ON public.aplicaciones 
  FOR EACH ROW EXECUTE FUNCTION public.process_carencia_aplicacion();


-- 3.2 Trigger para Registro Automático de Bitácora de Cambios (Auditoría)
CREATE OR REPLACE FUNCTION public.process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_user_id TEXT;
  v_user_email TEXT;
  v_company_id UUID;
  v_antes JSONB := NULL;
  v_despues JSONB := NULL;
BEGIN
  -- Intentar recuperar credenciales del JWT de Supabase
  BEGIN
    v_user_id := COALESCE(auth.jwt() ->> 'sub', 'sistema_api');
    v_user_email := COALESCE(auth.jwt() ->> 'email', 'sistema_api');
    v_company_id := public.current_company();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := 'sistema_api';
    v_user_email := 'sistema_api';
    v_company_id := NULL;
  END;

  IF (TG_OP = 'DELETE') THEN
    v_antes := to_jsonb(OLD);
    v_company_id := COALESCE(v_company_id, OLD.company_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_antes := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    v_company_id := COALESCE(v_company_id, NEW.company_id);
  ELSIF (TG_OP = 'INSERT') THEN
    v_despues := to_jsonb(NEW);
    v_company_id := COALESCE(v_company_id, NEW.company_id);
  END IF;

  -- Insertar en logs de auditoría si la empresa está identificada
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      company_id, usuario_id, usuario_email, fecha, accion, modulo, antes, despues
    ) VALUES (
      v_company_id, v_user_id, v_user_email, now(), TG_OP, TG_TABLE_NAME, v_antes, v_despues
    );
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjuntar Auditoría Automática a las tablas operacionales críticas
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY['lotes', 'maquinaria', 'trabajadores', 'inventario', 'aplicaciones', 'cosechas', 'monitoreos'];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON public.%I', t_name, t_name);
    EXECUTE format('CREATE TRIGGER audit_%I_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t_name, t_name);
  END LOOP;
END $$;


-- 4. RPCS TRANSACCIONALES PARA EL BACKEND

-- 4.1 Iniciar labor de maquinaria
CREATE OR REPLACE FUNCTION public.iniciar_labor_maquinaria(
  p_maquinaria_id       UUID,
  p_operator            VARCHAR,
  p_lot                 VARCHAR,
  p_activity            VARCHAR,
  p_start_time          TIMESTAMPTZ,
  p_start_horometro     NUMERIC,
  p_start_fuel          NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_jornada_id UUID;
  v_company_id UUID;
  v_result JSONB;
BEGIN
  v_company_id := public.current_company();
  
  -- Validar pertenencia
  IF NOT EXISTS (SELECT 1 FROM public.maquinaria WHERE id = p_maquinaria_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Acceso denegado: Maquinaria no pertenece al tenant activo.';
  END IF;

  INSERT INTO public.jornadas_maquinaria (
    company_id, maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status
  ) VALUES (
    v_company_id, p_maquinaria_id, p_operator, p_lot, p_activity, p_start_time, p_start_horometro, p_start_fuel, 'En Progreso'
  ) RETURNING id INTO v_jornada_id;

  UPDATE public.maquinaria
  SET
    status = 'Operando',
    operator_name = p_operator,
    current_task = p_activity,
    current_lot = p_lot
  WHERE id = p_maquinaria_id;

  v_result := jsonb_build_object('success', true, 'jornada_id', v_jornada_id);
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 4.2 Finalizar labor de maquinaria con cálculo automático de costos
CREATE OR REPLACE FUNCTION public.finalizar_labor_maquinaria(
  p_jornada_id      UUID,
  p_end_time        TIMESTAMPTZ,
  p_end_horometro   NUMERIC,
  p_end_fuel        NUMERIC,
  p_notes           TEXT
) RETURNS JSONB AS $$
DECLARE
  v_maquinaria_id   UUID;
  v_start_horometro NUMERIC;
  v_start_fuel      NUMERIC;
  v_hours           NUMERIC;
  v_fuel_used       NUMERIC;
  v_cost_op         NUMERIC;
  v_cost_fuel       NUMERIC;
  v_cost_maint      NUMERIC;
  v_cost_dep        NUMERIC;
  v_hours_op        NUMERIC;
  v_calculated_cost NUMERIC;
  v_company_id      UUID;
  v_lot_name        TEXT;
  v_lote_id         UUID;
  v_result          JSONB;
BEGIN
  v_company_id := public.current_company();

  SELECT maquinaria_id, start_horometro, start_fuel, lot 
  INTO v_maquinaria_id, v_start_horometro, v_start_fuel, v_lot_name
  FROM public.jornadas_maquinaria
  WHERE id = p_jornada_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acceso denegado o Bitácora de jornada no encontrada.';
  END IF;

  v_hours := p_end_horometro - v_start_horometro;
  IF v_hours < 0 THEN
    RAISE EXCEPTION 'El horómetro final (%) no puede ser inferior al inicial (%).', p_end_horometro, v_start_horometro;
  END IF;

  v_fuel_used := GREATEST(0, v_start_fuel - p_end_fuel);

  SELECT cost_operator, cost_fuel, cost_maintenance, cost_depreciation, hours_of_operation
  INTO v_cost_op, v_cost_fuel, v_cost_maint, v_cost_dep, v_hours_op
  FROM public.maquinaria
  WHERE id = v_maquinaria_id AND company_id = v_company_id;

  v_calculated_cost := v_hours * (COALESCE(v_cost_op, 0) + COALESCE(v_cost_fuel, 0) + COALESCE(v_cost_maint, 0) + COALESCE(v_cost_dep, 0));

  UPDATE public.jornadas_maquinaria
  SET
    end_time = p_end_time,
    end_horometro = p_end_horometro,
    end_fuel = p_end_fuel,
    calculated_hours = v_hours,
    calculated_fuel_consumption = v_fuel_used,
    calculated_cost = v_calculated_cost,
    notes = p_notes,
    status = 'Finalizada'
  WHERE id = p_jornada_id;

  UPDATE public.maquinaria
  SET
    status = 'Disponible',
    operator_name = NULL,
    current_task = NULL,
    current_lot = NULL,
    hours_of_operation = COALESCE(v_hours_op, 0) + v_hours,
    hours_today = v_hours
  WHERE id = v_maquinaria_id;

  -- Intentar asociar y registrar el costo en el lote
  SELECT id INTO v_lote_id FROM public.lotes WHERE nombre = v_lot_name AND company_id = v_company_id LIMIT 1;
  IF v_lote_id IS NOT NULL THEN
    PERFORM public.registrar_costo_lote(
      v_company_id, v_lote_id, 'Maquinaria', v_calculated_cost, p_end_time::date, 'jornadas_maquinaria', p_jornada_id, 'Uso de maquinaria en labor fitosanitaria/campo.'
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'hours_worked', v_hours,
    'fuel_consumed', v_fuel_used,
    'cost', v_calculated_cost
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 4.3 Registrar Mantenimiento de Maquinaria
CREATE OR REPLACE FUNCTION public.registrar_mantenimiento_maquinaria(
  p_maquinaria_id UUID,
  p_date          DATE,
  p_horometro     NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_next_m DATE;
  v_current_next_m_hours INT;
  v_next_m_hours INT;
  v_company_id UUID;
  v_result JSONB;
BEGIN
  v_company_id := public.current_company();

  SELECT next_maintenance_hours INTO v_current_next_m_hours
  FROM public.maquinaria
  WHERE id = p_maquinaria_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acceso denegado o Maquinaria no encontrada.';
  END IF;

  v_next_m := p_date + INTERVAL '90 days';
  v_next_m_hours := COALESCE(v_current_next_m_hours, 250) + 250;

  UPDATE public.maquinaria
  SET
    status = 'Disponible',
    last_maintenance = p_date,
    next_maintenance = v_next_m,
    next_maintenance_hours = v_next_m_hours
  WHERE id = p_maquinaria_id;

  v_result := jsonb_build_object(
    'success', true,
    'next_maintenance', v_next_m,
    'next_maintenance_hours', v_next_m_hours
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 4.4 Registrar Movimiento Inventario (Entradas/Salidas Manuales)
CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
  p_item_id       UUID,
  p_cantidad      NUMERIC,
  p_tipo          VARCHAR,
  p_motivo        TEXT,
  p_warehouse_id  UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_antes NUMERIC;
  v_despues NUMERIC;
  v_company_id UUID;
  v_result JSONB;
BEGIN
  v_company_id := public.current_company();

  SELECT quantity INTO v_antes FROM public.inventario WHERE id = p_item_id AND company_id = v_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acceso denegado o Insumo no encontrado en el stock.';
  END IF;

  IF p_tipo = 'entrada' THEN
    v_despues := v_antes + p_cantidad;
  ELSIF p_tipo = 'salida' THEN
    v_despues := GREATEST(0, v_antes - p_cantidad);
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento no válido. Debe ser "entrada" o "salida".';
  END IF;

  UPDATE public.inventario 
  SET quantity = v_despues 
  WHERE id = p_item_id;

  INSERT INTO public.movimientos_inventario (
    company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id
  ) VALUES (
    v_company_id, p_item_id, p_cantidad, p_tipo, v_antes, v_despues, p_motivo, public.current_user_id(), p_warehouse_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'antes', v_antes,
    'despues', v_despues,
    'cantidad', p_cantidad,
    'tipo', p_tipo
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 4.5 Completar Auditoría Fitosanitaria
CREATE OR REPLACE FUNCTION public.rpc_completar_auditoria(
  p_aplicacion_id UUID,
  p_ip_address    TEXT,
  p_user_agent    TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_company_id UUID;
BEGIN
  v_company_id := public.current_company();
  
  IF NOT EXISTS (SELECT 1 FROM public.aplicaciones WHERE id = p_aplicacion_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Acceso denegado: Aplicación fitosanitaria no encontrada.';
  END IF;
  
  UPDATE public.auditoria_aplicaciones
  SET 
    ip_address = p_ip_address,
    user_agent = p_user_agent,
    fecha = now()
  WHERE aplicacion_id = p_aplicacion_id AND company_id = v_company_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 4.6 Generar Código Único de Aplicación Fitosanitaria
CREATE OR REPLACE FUNCTION public.generar_codigo_apl(
  p_lote_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_company_id UUID;
  v_count INT;
  v_codigo TEXT;
BEGIN
  SELECT company_id INTO v_company_id FROM public.lotes WHERE id = p_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado.';
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM public.aplicaciones WHERE company_id = v_company_id;
  
  v_codigo := 'APL-' || LPAD((v_count + 1)::text, 5, '0');
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
