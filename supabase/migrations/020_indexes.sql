-- ==============================================================================
-- SKYCROP DATABASE V2: 020_indexes.sql
-- Descripción: Índices de Optimización de Consultas Espaciales y Compuestos
-- ==============================================================================

-- 1. Índices de Llave Foránea y Rendimiento de Multi-Tenant (Búsquedas por Empresa)
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users (company_id);
CREATE INDEX IF NOT EXISTS idx_predios_company_id ON public.predios (company_id);
CREATE INDEX IF NOT EXISTS idx_lotes_company_id ON public.lotes (company_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_company_id ON public.trabajadores (company_id);
CREATE INDEX IF NOT EXISTS idx_cuadrillas_company_id ON public.cuadrillas (company_id);
CREATE INDEX IF NOT EXISTS idx_cuadrilla_miembros_company_id ON public.cuadrilla_miembros (company_id);
CREATE INDEX IF NOT EXISTS idx_bodegas_company_id ON public.bodegas (company_id);
CREATE INDEX IF NOT EXISTS idx_almacenamientos_company_id ON public.almacenamientos (company_id);
CREATE INDEX IF NOT EXISTS idx_inventario_company_id ON public.inventario (company_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_company_id ON public.movimientos_inventario (company_id);
CREATE INDEX IF NOT EXISTS idx_labores_company_id ON public.labores (company_id);
CREATE INDEX IF NOT EXISTS idx_labor_trabajadores_company_id ON public.labor_trabajadores (company_id);
CREATE INDEX IF NOT EXISTS idx_planificacion_cosechas_company_id ON public.planificacion_cosechas (company_id);
CREATE INDEX IF NOT EXISTS idx_maquinaria_company_id ON public.maquinaria (company_id);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_company_id ON public.aplicaciones (company_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_maquinaria_company_id ON public.jornadas_maquinaria (company_id);
CREATE INDEX IF NOT EXISTS idx_historial_actividades_company_id ON public.historial_actividades (company_id);
CREATE INDEX IF NOT EXISTS idx_cursos_formacion_company_id ON public.cursos_formacion (company_id);
CREATE INDEX IF NOT EXISTS idx_monitoreos_company_id ON public.monitoreos (company_id);
CREATE INDEX IF NOT EXISTS idx_registros_formacion_company_id ON public.registros_formacion (company_id);
CREATE INDEX IF NOT EXISTS idx_nominas_company_id ON public.nominas (company_id);
CREATE INDEX IF NOT EXISTS idx_costos_company_id ON public.costos (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_aplicaciones_company_id ON public.auditoria_aplicaciones (company_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_sanitaria_company_id ON public.auditoria_sanitaria (company_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_prescripcion_company_id ON public.auditoria_prescripcion_alta_toxicidad (company_id);
CREATE INDEX IF NOT EXISTS idx_security_events_company_id ON public.security_events (company_id);

-- 2. Índices Compuestos para Filtros y Consultas Analíticas Frecuentes
CREATE INDEX IF NOT EXISTS idx_lotes_company_predio ON public.lotes (company_id, predio_id);
CREATE INDEX IF NOT EXISTS idx_company_users_clerk ON public.company_users (company_id, clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_compuesto ON public.trabajadores (company_id, estado);
CREATE INDEX IF NOT EXISTS idx_labores_company_fecha ON public.labores (company_id, fecha);
CREATE INDEX IF NOT EXISTS idx_jornadas_company_start ON public.jornadas_maquinaria (company_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_nominas_company_trabajador ON public.nominas (company_id, trabajador_id);
CREATE INDEX IF NOT EXISTS idx_registros_formacion_company_trabajador ON public.registros_formacion (company_id, trabajador_id);
CREATE INDEX IF NOT EXISTS idx_security_events_company_fecha ON public.security_events (company_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_fecha ON public.audit_logs (company_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_item ON public.movimientos_inventario (company_id, item_id);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_lote ON public.aplicaciones (company_id, lote_id);
CREATE INDEX IF NOT EXISTS idx_monitoreos_lote ON public.monitoreos (company_id, lote_id);
