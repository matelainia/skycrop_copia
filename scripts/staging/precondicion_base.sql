-- ============================================================================
-- PRECONDICION: base 001-042 completa antes de 043-047. Solo SELECT.
-- Toda fila con existe='f' debe resolverse (aplicar la migracion base)
-- ANTES de 043. Las migraciones 043-045 omiten lo ausente y los checks lo
-- reportan como FAIL: una base incompleta jamas abre la compuerta.
-- ============================================================================
WITH esperado(t) AS (VALUES
  ('companies'),('profiles'),('company_users'),('predios'),('lotes'),
  ('trabajadores'),('cuadrillas'),('cuadrilla_miembros'),('bodegas'),
  ('almacenamientos'),('productos'),('inventario'),('movimientos_inventario'),
  ('labores'),('labor_trabajadores'),('planificacion_cosechas'),
  ('aplicaciones'),('cosechas'),('maquinaria'),('jornadas_maquinaria'),
  ('historial_actividades'),('cursos_formacion'),('monitoreos'),
  ('registros_formacion'),('nominas'),('costos'),
  ('audit_logs'),('auditoria_aplicaciones'),('auditoria_sanitaria'),
  ('auditoria_prescripcion_alta_toxicidad'),('security_events'),('alertas'),
  ('cultivos'),('protocolos_evaluacion'),('draft_evaluaciones'),
  ('evaluation_snapshots'),('evaluation_events'),
  ('fertilization_plans'),('fertilization_applications'),
  ('fertilizacion_recomendaciones'),('fertilizacion_recomendacion_detalle'),
  ('analisis_suelos'),('resultados_analisis_suelo'),
  ('lotes_producto'),('procesos_postcosecha'),('clientes'),('destinos'),
  ('ventas'),('venta_detalles'),('despachos'),('facturas'),('factura_detalles'))
SELECT e.t AS tabla,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = e.t) AS existe,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = e.t) THEN 'PASS' ELSE 'FAIL' END AS status
FROM esperado e ORDER BY status, tabla;
