# Auditoría 2 — checklist + compuerta binaria (sobre staging + código actual)

> Mismo inventario que Auditoría 1 (comparación objetiva). Sin estados intermedios:
> **APROBADA → diseñar trazabilidad. RECHAZADA → nuevo ciclo.** Empezar
> "parcialmente" la trazabilidad está prohibido.

## Seguridad (todo obligatorio)

- [ ] RLS 035 correcto: 4 policies en `fertilizacion_recomendaciones` + 4 en
      detalle vía padre; `company_id` con trigger; `UNIQUE(company,code)`.
- [ ] RLS 031 correcto: 7 SELECT con `EXISTS(monitoreos)` tenant; 0 `USING(true)`;
      escritura solo `service_role`.
- [ ] Sin fallback semilla: `current_company()`/`current_user_id()` → NULL sin JWT.
- [ ] `anon` sin EXECUTE en helpers de contexto.
- [ ] G2: `ESCAPES = 0` (directo) + probes backend sin escapes.
- [ ] RPCs (`guardar_evaluacion_completa`, `registrar_cosecha_empresa`,
      `trazabilidad_por_codigo_empresa`, `reservar_codigo_serie`) no cruzan empresas.
- [ ] `service_role` no elimina validaciones de negocio (assert + triggers activos).

## Integridad

- [ ] Cadena empresa → predio → lote consistente para operaciones nuevas (H1).
- [ ] C6: CRÍTICA = 0, ALTA = 0; MEDIAS/BAJAS clasificadas y documentadas como
      históricas cuando no son reconstruibles (sin valores inventados).
- [ ] Cosecha unificada en un único flujo; códigos atómicos en uso.
- [ ] Relaciones críticas con plan de endurecimiento (migración 048+ propuesta).

## Auditoría

- [ ] `audit_logs` append-only: UPDATE/DELETE fallan desde rol operativo y admin.
- [ ] Middleware solo emite `INSERT/UPDATE/DELETE/LOGIN/LOGOUT`; sin tenant no
      inserta (fail-closed); `company_id IS NULL` = 0 filas nuevas.
- [ ] CREATE/UPDATE/DELETE reales generan evento con actor, módulo, tabla,
      registro, antes/después.

## Aplicación (actor real en TODOS los módulos)

- [ ] Sanitario, Talento humano, Maquinaria, Fertilización, Monitoreos, Cosecha,
      Inventario: `grep` sin `Andrés Castro|Pedro Gómez|Empresa Demo|Azoxistrobin|
      `PU-003|ICA-3456|27.5|15000|jornal...1.0|empresa_id = null` en rutas de
      escritura (placeholders de UI con datos reales: Climate, PDF, labels '—'
      están permitidos si no persisten).
- [ ] Sin flujos legacy duplicados; cosecha un flujo; IDs de entidades reales;
      `company_id` de UI nunca confiable (validación backend/Supabase); 401/403
      manejados.

## Esquema

- [ ] Diff prod vs staging = exactamente objetos 043–047 (ver `schema_snapshot.sql`).
