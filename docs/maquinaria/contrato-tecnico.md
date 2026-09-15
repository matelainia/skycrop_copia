# Contrato técnico — Módulo Maquinaria (congelado)

> Estado: **CONGELADO para diseño**. Ningún cambio en `apps/web/src/modules/maquinaria/`
> sin actualizar este documento primero.
> Orden obligatorio: **Contrato → Supabase → seguridad/RLS → servicios/RPC →
> repositorios → hooks → UI → pruebas E2E.**
> La spec visual es **contrato de experiencia**, no contrato de datos.

## 1. Alcance y principios

1. Fuente única de verdad: este documento + `matriz-permisos.md` + `plan-migracion.md`.
2. Multiempresa mediante `company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE`.
   El frontend **nunca** decide `company_id`, `usuario_id`, `rol` o `tenant`.
3. RLS es la frontera real. UI/permisos `can()` son solo UX.
4. Eventos críticos append-only. El `localStorage` actual
   (`apps/web/src/modules/maquinaria/audit/audit.service.js:29-50`) **no es auditoría**.
5. Prohibido hardcodear KPIs. Sin datos suficientes: `— / Sin datos suficientes`.
6. Separación estricta: entidad `maquinaria` ≠ operaciones ≠ mantenimiento ≠
   combustible ≠ eventos. Nada de tabla gigante consultada con `select('*')`.
7. Conservados salvo que el contrato exija cambio de interfaz:
   `modules/maquinaria/index.jsx` (router por `subTab`),
   `context/MachineryProvider.jsx` (shell), `types/Machine.js` (modelo base).

Estado actual verificado (base del contrato):

- `supabase/migrations/015_ejecuciones.sql:7-32` tabla `maquinaria`,
  `:84-103` tabla `jornadas_maquinaria`. No existen tablas de mantenimiento,
  combustible ni eventos.
- `supabase/migrations/022_functions.sql:323-497` 3 RPC `SECURITY INVOKER`
  sin `SET search_path` ni `REVOKE/GRANT`: `iniciar/finalizar_labor`,
  `registrar_mantenimiento`.
- RLS generado en `021_rls.sql:128-183`, índices en `020_indexes.sql:20,22,40`.
- Frontend: `repository/machinery.repository.js:12-15` usa `select('*')`;
  `repository/operation.repository.js:12-15` usa `select('*, maquinaria(*)')`;
  `permissions/can*.js` son `return true` mock.

## 2. Modelo de datos objetivo

### 2.1 `maquinaria` (evolución de `015:7-32`, no tabla nueva)

```text
id UUID PK DEFAULT gen_random_uuid()
company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
codigo VARCHAR(50) NOT NULL            -- canónico; legacy codigo_id se migra
nombre VARCHAR(100) NOT NULL
tipo VARCHAR(50) NOT NULL CHECK (tipo IN
  ('Tractor','Cosechadora','Pulverizadora','Implemento','Camion','Vehiculo','Motocultor','Otro'))
marca VARCHAR(100), modelo VARCHAR(100), serial VARCHAR(100), placa VARCHAR(20),
anio INT CHECK (anio BETWEEN 1950 AND 2100),
capacidad NUMERIC CHECK (capacidad >= 0), unidad_capacidad VARCHAR(20)
estado VARCHAR(30) NOT NULL DEFAULT 'Disponible'  -- ver §3
fecha_adquisicion DATE
horometro_actual NUMERIC NOT NULL DEFAULT 0 CHECK (horometro_actual >= 0)
activo BOOLEAN NOT NULL DEFAULT true
deleted_at TIMESTAMPTZ, deleted_by TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (company_id, codigo)
```

Notas de migración: `codigo_id → codigo` (upper/trim), `name → nombre`,
`status → estado` con mapeo §3, `hours_of_operation → horometro_actual`,
`fuel_consumption VARCHAR` se retira del maestro (pasa a detalle en §5),
costos unitarios se conservan como `costo_operador_hora, costo_combustible_hora,
costo_mantenimiento_hora, costo_depreciacion_hora`. `photo_url → image_url`.

### 2.2 `maquinaria_operaciones` (reemplaza `jornadas_maquinaria`)

```text
id UUID PK DEFAULT gen_random_uuid()
company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
maquinaria_id UUID NOT NULL REFERENCES maquinaria(id) ON DELETE RESTRICT
operador_id UUID REFERENCES trabajadores(id) ON DELETE SET NULL  -- hoy VARCHAR libre, migrar best-effort
operador_nombre VARCHAR(100) NOT NULL  -- snapshot histórico, no se actualiza
labor VARCHAR(100) NOT NULL
lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL  -- hoy `lot VARCHAR`, migrar por nombre+company
lote_nombre VARCHAR(100) NOT NULL      -- snapshot histórico
inicio TIMESTAMPTZ NOT NULL, fin TIMESTAMPTZ
horometro_inicio NUMERIC NOT NULL CHECK (horometro_inicio >= 0)
horometro_fin NUMERIC CHECK (horometro_fin >= 0)
horas NUMERIC GENERATED ALWAYS AS (fin... ) o calculada en RPC
combustible_l NUMERIC CHECK (combustible_l >= 0)
costo_total NUMERIC CHECK (costo_total >= 0)
estado VARCHAR(20) NOT NULL DEFAULT 'En Progreso'
  CHECK (estado IN ('En Progreso','Finalizada','Cancelada'))
notas TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by TEXT NOT NULL
CONSTRAINT chk_jornada CHECK (fin IS NULL OR fin >= inicio)
CONSTRAINT chk_horometro CHECK (horometro_fin IS NULL OR horometro_fin >= horometro_inicio)
CONSTRAINT uq_activa EXCLUDE -- o índice parcial: una sola 'En Progreso' por máquina:
  CREATE UNIQUE INDEX ... ON maquinaria_operaciones (maquinaria_id) WHERE estado='En Progreso'
```

### 2.3 `maquinaria_mantenimientos`

```text
id UUID PK, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
maquinaria_id UUID NOT NULL REFERENCES maquinaria(id) ON DELETE RESTRICT
tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Preventivo','Correctivo'))
estado VARCHAR(20) NOT NULL DEFAULT 'Programado'
  CHECK (estado IN ('Programado','En ejecucion','Completado','Vencido','Cancelado'))
descripcion TEXT NOT NULL, fecha_programada DATE NOT NULL,
fecha_ejecucion DATE, horometro NUMERIC NOT NULL CHECK (horometro >= 0),
costo NUMERIC NOT NULL DEFAULT 0 CHECK (costo >= 0),
proveedor VARCHAR(150), responsable TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by TEXT NOT NULL,
executed_at TIMESTAMPTZ, executed_by TEXT
-- Inmutabilidad: filas Completado/Vencido no UPDATE/DELETE (trigger §7 + RLS §9)
```

### 2.4 `maquinaria_combustible`

```text
id UUID PK, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
maquinaria_id UUID NOT NULL REFERENCES maquinaria(id) ON DELETE RESTRICT
fecha TIMESTAMPTZ NOT NULL DEFAULT now()
cantidad NUMERIC NOT NULL CHECK (cantidad > 0)
unidad VARCHAR(10) NOT NULL DEFAULT 'L' CHECK (unidad IN ('L','gal'))
costo_unitario NUMERIC NOT NULL CHECK (costo_unitario >= 0)
costo_total NUMERIC NOT NULL CHECK (costo_total >= 0)  -- = cantidad*costo_unitario (RPC valida)
horometro NUMERIC NOT NULL CHECK (horometro >= 0)     -- >= último válido (RPC valida)
operador_id UUID REFERENCES trabajadores(id) ON DELETE SET NULL
proveedor VARCHAR(150), observacion TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by TEXT NOT NULL
-- Inmutable tras insert (trigger §7 + RLS §9). Correcciones = nueva fila de ajuste.
```

### 2.5 `maquinaria_eventos` (append-only)

```text
id UUID PK DEFAULT gen_random_uuid()
company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
maquinaria_id UUID NOT NULL REFERENCES maquinaria(id) ON DELETE CASCADE
tipo_evento VARCHAR(40) NOT NULL CHECK (tipo_evento IN
  ('REGISTRO','EDICION','CAMBIO_ESTADO','JORNADA_INICIO','JORNADA_FIN','JORNADA_CANCELADA',
   'COMBUSTIBLE','MANTENIMIENTO_PROGRAMADO','MANTENIMIENTO_EJECUTADO',
   'HOROMETRO_CORRECCION','INCIDENCIA','RETIRO'))
entidad_tipo VARCHAR(40), entidad_id UUID
usuario_id TEXT NOT NULL, rol TEXT NOT NULL
payload JSONB NOT NULL DEFAULT '{}'
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- Sin UPDATE ni DELETE para ningún rol (RLS §9 + trigger). Lectura por empresa.
```

### 2.6 Índices obligatorios (extienden `020_indexes.sql`)

```sql
CREATE INDEX IF NOT EXISTS idx_maquinaria_company_estado ON public.maquinaria (company_id, estado);
CREATE INDEX IF NOT EXISTS idx_maquinaria_company_codigo ON public.maquinaria (company_id, codigo);
CREATE INDEX IF NOT EXISTS idx_mqoper_company_maq ON public.maquinaria_operaciones (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqoper_company_inicio ON public.maquinaria_operaciones (company_id, inicio DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mqoper_activa ON public.maquinaria_operaciones (maquinaria_id) WHERE estado = 'En Progreso';
CREATE INDEX IF NOT EXISTS idx_mqmto_company_maq ON public.maquinaria_mantenimientos (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqmto_company_fecha ON public.maquinaria_mantenimientos (company_id, fecha_programada);
CREATE INDEX IF NOT EXISTS idx_mqfuel_company_maq ON public.maquinaria_combustible (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqfuel_company_fecha ON public.maquinaria_combustible (company_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mqev_company_maq ON public.maquinaria_eventos (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqev_company_created ON public.maquinaria_eventos (company_id, created_at DESC);
```

## 3. Máquina y estados (taxonomía única)

Canónico DB (coincide con `015:13`, corrige frontend):

```text
Disponible | Operando | Mantenimiento | Fuera de servicio
```

Mapeo de compatibilidad (solo migración, no API pública):

```text
'En mantenimiento' (frontend constants/machineryStatus.js:4) → 'Mantenimiento'
'DENY cualquier otro string'
```

Transiciones válidas (enforzadas en RPC + trigger, nunca UPDATE libre):

```text
Disponible → Operando        (iniciar_jornada)
Operando → Disponible        (finalizar_jornada)
Disponible → Mantenimiento   (programar_mantenimiento / incidencia crítica)
Mantenimiento → Disponible   (registrar_mantenimiento ejecutado)
Disponible → Fuera de servicio (retiro, solo admin, con motivo)
Fuera de servicio → Disponible (rehabilitación, solo admin/gerente, con motivo)
Mantenimiento → Fuera de servicio (hallazgo crítico)
```

Prohibido: `Operando → Mantenimiento` directo (cerrar jornada primero),
cualquier transición desde/hacia estados inexistentes, `UPDATE maquinaria SET estado`
fuera de RPC (bloqueado por RLS §9: UPDATE de `estado` solo vía RPC definer o
roles admin; el frontend usa RPC siempre).

## 4. Contrato de operaciones

- Inicio: requiere máquina `Disponible`, sin jornada `En Progreso` (índice parcial §2.2;
  concurrencia resuelta en transacción, no con `disabled`).
- `horometro_inicio >= horometro_actual`; si menor → error `HOROMETRO_REGRESIVO`
  salvo `actualizar_horometro(modo='correccion', motivo)` con rol autorizado.
- `lote_id FK`; `lote_nombre` snapshot. Prohibido lote libre sin resolución
  (falla actual `022:437` que resolvía por `nombre`).
- `operador_id FK trabajadores` + `operador_nombre` snapshot.
- Fin: `fin >= inicio`, `horometro_fin >= horometro_inicio`,
  `horas = horometro_fin - horometro_inicio` (no timestamps para horas facturables),
  actualiza `maquinaria.horometro_actual = horometro_fin`, estado → `Disponible`,
  registra costo en lote vía `registrar_costo_lote` con `lote_id` (no por nombre).
- Cancelación: requiere motivo, deja evento `JORNADA_CANCELADA`, no borra fila.
- Trazabilidad: cada jornada finalizada emite evento + queda legible read-only
  (equipo → operador → labor → lote → fecha → horas → consumo).

## 5. Combustible

Campos §2.4. Reglas:

- `cantidad > 0`, `costo_unitario >= 0`, `costo_total = cantidad * costo_unitario`
  (tolerancia 0.01, la RPC recalcula).
- `horometro >= max(horometro_actual, último registro)`; si menor → `HOROMETRO_REGRESIVO`.
- `fecha <= now() + 1h` (reloj), `fecha >= fecha_adquisicion`.
- Relación analítica: `L/h = sum(cantidad)/sum(horas)` por máquina/periodo solo vía
  vista/RPC §12; si denominador insuficiente → `Sin datos suficientes`, nunca 0 inventado.
- Correcciones: nueva fila con `observacion='AJUSTE de <id>: motivo'`, nunca UPDATE.

## 6. Mantenimiento

- `tipo`: Preventivo | Correctivo. `estado`: Programado | En ejecucion |
  Completado | Vencido | Cancelado.
- Programar: cualquier fecha futura o pasada con `horometro` de referencia;
  si `tipo=Preventivo`, calcula `fecha_estimada` y `horometro_estimado`.
- Máquina pasa a `Mantenimiento` al iniciar ejecución (`En ejecucion`); bloquea
  `iniciar_jornada` con error `MAQUINA_NO_OPERABLE`.
- Completar: exige `fecha_ejecucion`, `horometro` (avanza `horometro_actual` si mayor),
  `costo >= 0`; estado máquina → `Disponible`; emite evento.
- Vencido: job/vista marca `Programado` con `fecha_programada < hoy` o
  `horometro_actual > horometro_programado` como `Vencido` (lectura, no muta historial).
- Cancelado: requiere motivo, conserva fila.

## 7. Eventos y auditoría

- `datos operativos ≠ eventos`. Toda RPC crítica escribe en `maquinaria_eventos`
  dentro de la misma transacción: `{quien (sub), rol, que, maquina, entidad, antes/despues, motivo}`.
- `maquinaria_eventos`: sin UPDATE/DELETE (trigger `RAISE EXCEPTION` + ausencia de
  policies UPDATE/DELETE). Corrección = nuevo evento.
- `maquinaria_operaciones` Finalizada/Cancelada, `maquinaria_combustible` y
  mantenimientos Completado/Vencido: inmutables (trigger bloquea UPDATE/DELETE).
- `created_by/usuario_id/empresa` derivan de `auth.jwt()` (`current_company()`,
  `current_user_id()`), jamás del body.
- Triggers a conservar/añadir: `secure_company_id_trg` (extender a las 5 tablas),
  `audit_*` de `022:307-317` (añadir `maquinaria_operaciones/_mantenimientos/_combustible/_eventos`
  a la matriz o a `audit_logs` según `044`), inmutabilidad, transición de estados.

## 8. RPC (contratos; firmas congeladas)

Convención: `SECURITY INVOKER` + `SET search_path = public, pg_temp` cuando basta RLS;
`SECURITY DEFINER` + mismo `search_path` + `REVOKE FROM PUBLIC` solo si debe escribir
`maquinaria_eventos`/cambiar estados saltando RLS de escritura. Todas:
`GRANT EXECUTE TO authenticated`, `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon`.
Errores como `RAISE EXCEPTION 'CODIGO: mensaje'` para mapeo UI (§11).
Todas resuelven `v_company := public.current_company()`,
`v_user := public.current_user_id()`, `v_rol := public.current_role_id()`.

| RPC | Parámetros | Retorno | Precondiciones / invariantes | Auth |
|---|---|---|---|---|
| `registrar_maquinaria(p_codigo, p_nombre, p_tipo, p_marca, p_modelo, p_serial, p_placa, p_anio, p_fecha_adquisicion, p_horometro_inicial)` | tipos §2.1 | `{success, maquinaria_id}` | `UNIQUE(company,codigo)`; horómetro ≥ 0; rol crear | INVOKER |
| `iniciar_jornada(p_maquinaria_id, p_operador_id, p_lote_id, p_labor, p_inicio, p_horometro_inicio)` | UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC | `{success, operacion_id}` | máquina Disponible + sin En Progreso; horómetro ≥ actual; lote y operador del tenant | INVOKER (transacción; lock `FOR UPDATE` en maquinaria) |
| `finalizar_jornada(p_operacion_id, p_fin, p_horometro_fin, p_combustible_l, p_notas)` | UUID,TIMESTAMPTZ,NUMERIC,NUMERIC,TEXT | `{success, horas, costo}` | `fin≥inicio`, `hor_fin≥hor_ini`; actualiza horómetro; costo a lote por `lote_id` | INVOKER |
| `registrar_combustible(p_maquinaria_id, p_fecha, p_cantidad, p_unidad, p_costo_unitario, p_horometro, p_operador_id, p_proveedor, p_observacion)` | ver §2.4 | `{success, registro_id, costo_total}` | reglas §5 | INVOKER |
| `programar_mantenimiento(p_maquinaria_id, p_tipo, p_descripcion, p_fecha_programada, p_horometro_ref)` | ... | `{success, mantenimiento_id}` | rol programar; horómetro ≥ 0 | INVOKER |
| `registrar_mantenimiento(p_mantenimiento_id, p_fecha_ejecucion, p_horometro, p_costo, p_proveedor, p_responsable)` | ... | `{success, next_mantenimiento}` | estado Programado/En ejecucion; avanza horómetro; máquina → Disponible | DEFINER (escribe evento + estado) |
| `actualizar_horometro(p_maquinaria_id, p_horometro, p_modo, p_motivo)` | NUMERIC, `('lectura'\|'correccion')`, TEXT | `{success, horometro_actual}` | `lectura`: ≥ actual. `correccion`: motivo obligatorio + rol admin/gerente; emite `HOROMETRO_CORRECCION` | DEFINER |
| `registrar_incidencia(p_maquinaria_id, p_severidad, p_descripcion)` | `('leve'\|'grave'\|'critica')`, TEXT | `{success, evento_id, estado}` | `critica` → máquina a Mantenimiento/Fuera de servicio; bloquea jornadas | INVOKER |

Códigos de error estables: `ACCESO_DENEGADO, MAQUINA_NO_OPERABLE, JORNADA_ACTIVA_EXISTE,
HOROMETRO_REGRESIVO, LOTE_FUERA_DE_TENANT, OPERADOR_FUERA_DE_TENANT, ESTADO_INVALIDO,
HISTORICO_INMUTABLE, COMBUSTIBLE_INVALIDO, MANTENIMIENTO_INVALIDO`.

Compatibilidad: `iniciar/finalizar_labor_maquinaria` y `registrar_mantenimiento_maquinaria`
(022) se conservan como wrappers legacy marcados `DEPRECATED` hasta que el frontend
migre; no se les añade funcionalidad.

## 9. RLS y grants (normativo)

Base existente: `021_rls.sql:49-50` ENABLE + `128-183` genera SELECT/INSERT/UPDATE/DELETE
`TO authenticated` con `company_id = current_company()`, DELETE solo `administrador`.

Endurecer para las 5 tablas objetivo:

```sql
-- Lectura: tenant (+ soft-delete donde aplique: maquinaria)
CREATE POLICY <t>_select_policy ON public.<t> FOR SELECT TO authenticated
  USING (company_id = public.current_company()
    AND (deleted_at IS NULL OR public.current_role_id() = 'administrador'));
-- Solo maquinaria tiene deleted_at; las demás: USING (company_id = ...).
-- Escritura operativa directa: SOLO tablas no inmutables y nunca `estado` sensible.
-- maquinaria: UPDATE sin cambio de estado (el estado lo cambian RPC DEFINER).
--   Implementación: USING/WITH CHECK tenant + trigger que rechaza cambio de `estado`
--   si current_setting('app.bypass_estado') IS DISTINCT FROM 'rpc'.
-- operaciones En Progreso: UPDATE permitido al creador/supervisor; Finalizada/Cancelada: REVOKE (sin policy UPDATE, trigger bloquea).
-- combustible/eventos/mantenimientos ejecutados: SIN policies UPDATE/DELETE.
-- DELETE físico: solo `administrador` y solo en maquinaria/operaciones En Progreso; resto sin policy DELETE.
-- RPC: REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated.
-- service_role: bypass RLS solo en backend (nunca en navegador).
```

Funciones `current_company/current_user_id/current_role_id` (`021:7-28,64-78`,
endurecidas en `041/043`): mantener `SECURITY DEFINER SET search_path = public, pg_temp`
+ `REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role`. Nuevas funciones igual
(patrón `048_traceability_events.sql:110,279,327`).

## 10. Permisos de aplicación

Ver `matriz-permisos.md` (normativo). Resumen: `ingeniero` lectura;
`supervisor` operación completa; `operario` lectura + iniciar/cerrar jornada y
combustible propio; `administrador/gerente` administración; `auditor/consulta/invitado`
lectura. `can()` solo UX; RLS/RPC deciden.

## 11. Contrato del frontend

Componentes (spec visual §37-38): `FleetHeader, FleetKpis/FleetKpiCard{title,value,subtitle,icon,status,trend,percentage},
FleetTable{Equipo,Tipo,Marca/Modelo,Estado,Operador,Horometro,Ultimo servicio,Acciones},
FleetFilters, MachinePanel, MachineStatus, MaintenanceCard, RecentActivity, FleetAnalytics`.
Datos: `useFleet/useMachine(id)/useOperations/useMaintenance/useFuel/useFleetAnalytics`
sobre repository → RPC/backend (nunca PostgREST directo para escrituras críticas).
Reglas: debounce búsqueda; paginación + sort/filtrado server-side; `select` explícito
de columnas; invalidación React Query por mutación (no `window.location.reload()`);
skeleton/empty (`Tu flota está vacía + [Registrar]`)/error con `[Reintentar]` sin
volcar `PostgrestError`/forbidden/conflict (`Esta maquinaria acaba de ser asignada…` +
refresh); responsive (panel derecho → drawer en tablet/mobile; tabla → `MachineCard`);
a11y (teclado, aria, focus en modales, no solo color); animaciones 150–250ms;
tokens `colors.primary/success/warning/danger/info/background/surface/border/text-*`,
fondo warm neutral, cards blancas `radius 14–18px`, sombra mínima.
Acciones peligrosas (eliminar/retirar/cancelar/corregir horómetro): confirmación + motivo + permiso.
Fechas: conservar zona horaria, mostrar `12 sep 2026 / 07:20` regional.

## 12. Analytics (contractual, no calculado en UI)

Fuente: vista `vw_maquinaria_fleet_summary(company_id, total, disponibles, operando,
mantenimiento, fuera_servicio)` + `vw_maquinaria_analytics(company_id, maquinaria_id,
periodo, horas, consumo_l, costo_total, costo_hora, l_h, mantenimientos_vencidos,
disponibilidad_pct, utilizacion_pct)` o RPC equivalentes `SECURITY INVOKER`
con `SET search_path`, `GRANT TO authenticated`. Filtros por `current_company()`
siempre. Si `n` insuficiente o periodo sin operaciones: `NULL → UI muestra —`.
`FleetAnalytics` (Uso 7/30/90d, Donut por tipo, Costos mensual) consume solo estas
fuentes; prohibido agregar en cliente desde `select('*')`.

## 13. Compatibilidad y migración

Ver `plan-migracion.md` (normativo). Resumen: migración `052` crea tablas nuevas +
mapea legacy (`jornadas_maquinaria → maquinaria_operaciones`, `codigo_id → codigo`,
`'En mantenimiento' → 'Mantenimiento'`, lote por `nombre+company → lote_id` con
cuarentena de no-match, operador libre → `operador_id` nullable + snapshot);
wrappers legacy DEPRECATED; rollback por migración versionada; staging primero,
producción solo con `0 P0/P1 + RLS PASS + isolation PASS + audit PASS + E2E PASS`.

## 14. Pruebas obligatorias (bloquean producción)

Static/preflight (tablas, columnas, FK, CHECK, UNIQUE, índices §2.6, triggers, RPC,
policies por operación, grants, vistas); RLS cross-company A/B/anon/sin permiso;
permisos por rol (matriz); RPC authorization con cliente hostil (forjar `company_id`,
`maquinaria_id`, horómetro regresivo, costo histórico, doble jornada, máquina en
mantenimiento, borrar evento); invariantes horómetro/combustible/mantenimiento;
concurrencia (doble `iniciar_jornada` → exactamente 1 `En Progreso`);
append-only (UPDATE/DELETE eventos e históricos → DENY); paginación/orden/filtros;
aislamiento empresa; E2E mock + `--live` (`PRE-FLIGHT → SELF CHECK → AUTH →
COMPANY ISOLATION → PERMISSION MATRIX → READ → WRITE → UPDATE → AUDIT →
TRACEABILITY → CLEANUP`; si falla PRE-FLIGHT, cero escrituras).
