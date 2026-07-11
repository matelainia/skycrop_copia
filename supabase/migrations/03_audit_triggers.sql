-- 1. Función para procesar y registrar auditorías automáticamente desde triggers
CREATE OR REPLACE FUNCTION process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_user_id TEXT;
  v_user_email TEXT;
  v_empresa_id UUID;
  v_antes JSONB := NULL;
  v_despues JSONB := NULL;
BEGIN
  -- Leer variables de contexto del JWT de Supabase
  BEGIN
    v_user_id := COALESCE(auth.jwt() ->> 'sub', 'sistema_api');
    v_user_email := COALESCE(auth.jwt() ->> 'email', 'sistema_api');
    v_empresa_id := (auth.jwt() ->> 'empresa_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := 'sistema_api';
    v_user_email := 'sistema_api';
    v_empresa_id := NULL;
  END;

  -- Capturar el estado anterior y posterior según la acción
  IF (TG_OP = 'DELETE') THEN
    v_antes := to_jsonb(OLD);
    IF v_empresa_id IS NULL AND (OLD.empresa_id IS NOT NULL) THEN
      v_empresa_id := OLD.empresa_id;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_antes := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    IF v_empresa_id IS NULL AND (NEW.empresa_id IS NOT NULL) THEN
      v_empresa_id := NEW.empresa_id;
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    v_despues := to_jsonb(NEW);
    IF v_empresa_id IS NULL AND (NEW.empresa_id IS NOT NULL) THEN
      v_empresa_id := NEW.empresa_id;
    END IF;
  END IF;

  -- Insertar en la tabla de logs de auditoría
  INSERT INTO audit_logs (
    usuario_id, 
    usuario_email, 
    empresa_id, 
    accion, 
    modulo, 
    antes, 
    despues
  ) VALUES (
    v_user_id, 
    v_user_email, 
    v_empresa_id, 
    TG_OP, 
    TG_TABLE_NAME, 
    v_antes, 
    v_despues
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear los Triggers de Auditoría para tablas clave
-- Auditoría de Lotes
DROP TRIGGER IF EXISTS audit_lotes_trigger ON lotes;
CREATE TRIGGER audit_lotes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON lotes
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Auditoría de Maquinaria
DROP TRIGGER IF EXISTS audit_maquinaria_trigger ON maquinaria;
CREATE TRIGGER audit_maquinaria_trigger
  AFTER INSERT OR UPDATE OR DELETE ON maquinaria
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Auditoría de Trabajadores
DROP TRIGGER IF EXISTS audit_trabajadores_trigger ON trabajadores;
CREATE TRIGGER audit_trabajadores_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trabajadores
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Auditoría de Inventario
DROP TRIGGER IF EXISTS audit_inventario_trigger ON inventario;
CREATE TRIGGER audit_inventario_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inventario
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();
