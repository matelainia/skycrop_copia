-- ====================================================================
-- SKYCROP: TRANSACTIONAL DATABASE FUNCTIONS - MODULE MAQUINARIA
-- Run this script inside the Supabase SQL Editor.
-- ====================================================================

-- 1. RPC to start a labor operation (Iniciar Labor)
CREATE OR REPLACE FUNCTION iniciar_labor_maquinaria(
  p_maquinaria_id UUID,
  p_operator VARCHAR,
  p_lot VARCHAR,
  p_activity VARCHAR,
  p_start_time TIMESTAMPTZ,
  p_start_horometro NUMERIC,
  p_start_fuel NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_jornada_id UUID;
  v_result JSONB;
BEGIN
  -- Insert into jornadas_maquinaria
  INSERT INTO jornadas_maquinaria (
    maquinaria_id,
    operator,
    lot,
    activity,
    start_time,
    start_horometro,
    start_fuel,
    status
  ) VALUES (
    p_maquinaria_id,
    p_operator,
    p_lot,
    p_activity,
    p_start_time,
    p_start_horometro,
    p_start_fuel,
    'En Progreso'
  ) RETURNING id INTO v_jornada_id;

  -- Update machinery status to 'Operando'
  UPDATE maquinaria
  SET
    status = 'Operando',
    operator_name = p_operator,
    current_task = p_activity,
    current_lot = p_lot
  WHERE id = p_maquinaria_id;

  v_result := jsonb_build_object(
    'success', true,
    'jornada_id', v_jornada_id
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 2. RPC to end a labor operation (Finalizar Labor)
CREATE OR REPLACE FUNCTION finalizar_labor_maquinaria(
  p_jornada_id UUID,
  p_end_time TIMESTAMPTZ,
  p_end_horometro NUMERIC,
  p_end_fuel NUMERIC,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_maquinaria_id UUID;
  v_start_horometro NUMERIC;
  v_start_fuel NUMERIC;
  v_hours NUMERIC;
  v_fuel_used NUMERIC;
  v_cost_op NUMERIC;
  v_cost_fuel NUMERIC;
  v_cost_maint NUMERIC;
  v_cost_dep NUMERIC;
  v_hours_op NUMERIC;
  v_calculated_cost NUMERIC;
  v_result JSONB;
BEGIN
  -- Get active operation details
  SELECT maquinaria_id, start_horometro, start_fuel 
  INTO v_maquinaria_id, v_start_horometro, v_start_fuel
  FROM jornadas_maquinaria
  WHERE id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada con ID % no encontrada.', p_jornada_id;
  END IF;

  -- Validate horometer
  v_hours := p_end_horometro - v_start_horometro;
  IF v_hours < 0 THEN
    RAISE EXCEPTION 'El horómetro final (%) no puede ser menor que el inicial (%).', p_end_horometro, v_start_horometro;
  END IF;

  -- Calculate fuel used
  v_fuel_used := v_start_fuel - p_end_fuel;
  IF v_fuel_used < 0 THEN
    v_fuel_used := 0;
  END IF;

  -- Get machinery cost rates
  SELECT cost_operator, cost_fuel, cost_maintenance, cost_depreciation, hours_of_operation
  INTO v_cost_op, v_cost_fuel, v_cost_maint, v_cost_dep, v_hours_op
  FROM maquinaria
  WHERE id = v_maquinaria_id;

  -- Calculate cost of operation
  v_calculated_cost := v_hours * (COALESCE(v_cost_op, 0) + COALESCE(v_cost_fuel, 0) + COALESCE(v_cost_maint, 0) + COALESCE(v_cost_dep, 0));

  -- Update jornadas_maquinaria
  UPDATE jornadas_maquinaria
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

  -- Update machinery status to 'Disponible' and increment operating hours
  UPDATE maquinaria
  SET
    status = 'Disponible',
    operator_name = NULL,
    current_task = NULL,
    current_lot = NULL,
    hours_of_operation = COALESCE(v_hours_op, 0) + v_hours,
    hours_today = v_hours
  WHERE id = v_maquinaria_id;

  v_result := jsonb_build_object(
    'success', true,
    'hours_worked', v_hours,
    'fuel_consumed', v_fuel_used,
    'cost', v_calculated_cost
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3. RPC to register maintenance (Registrar Mantenimiento)
CREATE OR REPLACE FUNCTION registrar_mantenimiento_maquinaria(
  p_maquinaria_id UUID,
  p_date DATE,
  p_horometro NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_next_m DATE;
  v_current_next_m_hours INT;
  v_next_m_hours INT;
  v_result JSONB;
BEGIN
  -- Next maintenance date is 90 days after service date
  v_next_m := p_date + INTERVAL '90 days';

  -- Retrieve next maintenance hours cycle
  SELECT next_maintenance_hours INTO v_current_next_m_hours
  FROM maquinaria
  WHERE id = p_maquinaria_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maquinaria con ID % no encontrada.', p_maquinaria_id;
  END IF;

  v_next_m_hours := COALESCE(v_current_next_m_hours, 250) + 250;

  -- Update machinery record
  UPDATE maquinaria
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
$$ LANGUAGE plpgsql;
