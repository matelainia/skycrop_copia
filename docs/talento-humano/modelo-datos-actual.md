# A3 — Modelo de datos actual — Talento Humano (solo lectura)

> Rama: `diagnostico/talento-humano-integral` | A0/A1: `cad8662` | A2: pendiente commit | Fecha: 2026-09-15.
> Fuente: DDL estático (`supabase/migrations/*.sql`). Comportamiento vivo (qué migraciones aplicaron) se verifica en fase RLS/`--live`, no aquí.

## 1. Inventario físico (8 tablas, nombres reales)

| # | Tabla física | Origen | Alias usado en docs/UI |
| --- | --- | --- | --- |
| 1 | `trabajadores` | `010` (+`026` CHECK) | trabajadores/personal |
| 2 | `cuadrillas` | `010` | cuadrillas |
| 3 | `cuadrilla_miembros` | `010` | miembros |
| 4 | `labores` | `014` | labores del día |
| 5 | `labor_trabajadores` | `014` | trabajadores/labor |
| 6 | `cursos_formacion` | `016` | cursos |
| 7 | `registros_formacion` | `016` | registros/capacitaciones |
| 8 | `nominas` | `017` | nóminas/pagos |

## 2. Columnas (tipos, null, defaults)

- `trabajadores`: `id UUID PK gen_random_uuid()`, `company_id UUID NOT NULL FK companies CASCADE`, `nombres/apellidos/identificacion TEXT NOT NULL`, `edad INT CHECK>=0 NULL`, `fecha_nacimiento/fecha_contratacion DATE NULL`, `tipo_contrato TEXT NOT NULL`, `rh_sanguineo/tipo_eps/tipo_arl/contacto_telefonico/contacto_emergencia/foto/copia_contrato_name TEXT NULL`, `rol TEXT NOT NULL`, `estado TEXT NOT NULL`, `deleted_at TIMESTAMPTZ NULL`, `deleted_by TEXT NULL`, `created_at TIMESTAMPTZ now() NOT NULL`. **Sin `updated_at`, sin `created_by/updated_by`, sin salario, sin `predio_id`, sin `user_id`.**
- `cuadrillas`: `id PK`, `company_id NOT NULL FK CASCADE`, `nombre TEXT NOT NULL`, `created_at`. Sin responsable, sin estado, sin auditoría.
- `cuadrilla_miembros`: `cuadrilla_id FK CASCADE NOT NULL`, `trabajador_id FK trabajadores CASCADE NOT NULL`, `company_id NOT NULL FK CASCADE`, `PK(cuadrilla_id,trabajador_id)`. Sin `created_at`.
- `labores`: `id PK`, `company_id NOT NULL FK CASCADE`, `titulo/tipo TEXT NOT NULL`, `descripcion TEXT NULL`, `lote TEXT NULL` (legacy), `lote_id UUID NULL FK lotes SET NULL`, `fecha DATE NULL`, `estado TEXT NOT NULL`, `asignacion TEXT NOT NULL` (sin CHECK), `cuadrilla_id FK SET NULL NULL`, `jornal NUMERIC CHECK>=0 NULL`, `created_at`. Sin `updated_at`/auditoría, sin `predio_id`.
- `labor_trabajadores`: `labor_id FK CASCADE NOT NULL`, `trabajador_id FK CASCADE NOT NULL`, `company_id NOT NULL FK CASCADE`, `PK(labor_id,trabajador_id)`. Sin `created_at`.
- `cursos_formacion`: `id PK`, `company_id NOT NULL FK CASCADE`, `nombre/tipo TEXT NOT NULL`, `total_horas NUMERIC CHECK>=0 NULL`, `created_at`. Sin auditoría.
- `registros_formacion`: `id PK`, `company_id NOT NULL FK CASCADE`, `trabajador_id FK CASCADE NULL`, `curso_id FK CASCADE NULL`, `fecha DATE NOT NULL`, `resultado TEXT NOT NULL`, `estado TEXT NOT NULL`, `certificado_url TEXT NULL`, `created_at`. Sin auditoría. (FKs NULLables: registro puede quedar huérfano de trabajador/curso.)
- `nominas`: `id PK`, `company_id NOT NULL FK CASCADE`, `trabajador_id FK CASCADE NULL`, `periodo VARCHAR(50) NOT NULL`, `salario_neto NUMERIC NOT NULL CHECK>=0`, `horas_extras/retenciones NUMERIC NOT NULL DEFAULT 0 CHECK>=0`, `total_neto NUMERIC NOT NULL CHECK>=0`, `estado VARCHAR(50) NOT NULL`, `fecha_pago DATE NULL`, `metodo_pago VARCHAR(50) NULL`, `comentarios TEXT NULL`, `created_at`, `updated_at`. **Única tabla TH con `updated_at`; ninguna con actor.**

## 3. PK / FK (grafo verificado, no hipotético)

```text
companies.id ──CASCADE──▶ trabajadores.company_id, cuadrillas.company_id, cuadrilla_miembros.company_id,
                          labores.company_id, labor_trabajadores.company_id, cursos_formacion.company_id,
                          registros_formacion.company_id, nominas.company_id
trabajadores.id ──CASCADE──▶ cuadrilla_miembros.trabajador_id, labor_trabajadores.trabajador_id,
                              nominas.trabajador_id (NULLable), registros_formacion.trabajador_id (NULLable),
                              bodegas.responsable_id (SET NULL, fuera del dominio)
cuadrillas.id ──CASCADE──▶ cuadrilla_miembros.cuadrilla_id ; ──SET NULL──▶ labores.cuadrilla_id
labores.id ──CASCADE──▶ labor_trabajadores.labor_id
cursos_formacion.id ──CASCADE──▶ registros_formacion.curso_id (NULLable)
lotes.id ──SET NULL──▶ labores.lote_id
```

La hipótesis A3.3 se confirma con dos correcciones: (a) `cuadrillas→labores` existe pero es `SET NULL` (borrar cuadrilla no borra labores); (b) `trabajadores` es raíz de 5 aristas (incl. `bodegas` externa).

## 4. Constraints

- UNIQUE: `(company_id,identificacion)` en trabajadores (única unicidad de negocio en TH). Sin UNIQUE en cuadrillas(nombre), nominas(periodo+trabajador) — doble nómina mismo periodo posible a nivel DB.
- CHECK: `trabajadores.estado` 6 valores + `tipo_contrato` 9 valores (tras `026` parche que legaliza lo que el frontend ya emitía); `labores.estado` 4 (`014:16`); `jornal>=0`; `nominas` 3 montos `>=0` + `estado` 3 (`017:16`); `cursos.tipo` 5 (`016:12`); `registros.estado` 4 (`016:45`); `edad>=0`, `total_horas>=0`. `asignacion`, `rol`, `periodo`, `metodo_pago`, `resultado` sin CHECK (texto libre).
- `026` es evidencia de **DB adaptada al frontend a posteriori** (comentario `026:4-6` lo declara), no de dominio diseñado.

## 5. Índices (`020`)

`company_id` en las 8 (`020:10-12,17-18,24,26-27`); compuestos: `trabajadores(company_id,estado)` (`020:38`), `labores(company_id,fecha)` (`020:39`), `nominas(company_id,trabajador_id)` (`020:41`), `registros(company_id,trabajador_id)` (`020:42`). Sin índice en puentes por miembro (`cuadrilla_miembros(trabajador_id)` sin índice dedicado), sin UNIQUE parcial anti-doble-nómina, sin índice `labores(lote_id)`.

## 6. RLS / triggers asociados (diseño en archivo)

- RLS `021`: ENABLE en las 8 + 4 policies genéricas por tabla (`SELECT/INSERT/UPDATE` por `company_id=current_company()`; `DELETE` solo `administrador`). Sin gate rol en escritura no-admin; sin validación cruzada TH.
- `secure_company_id_trg` (`022:54-67`): cubre **las 8 tablas TH incl. puentes** — autocompleta `company_id` NULL en INSERT y bloquea forgery (`FORGERY_ATTEMPT` → `security_events`). **Matiz a A0/A1**: el modelo SÍ tiene `company_id` en puentes y el trigger lo autofill si existe en vivo; el hueco `TENANT_TABLES` es del proxy cliente, no del DDL. Comportamiento vivo pendiente de sonda.
- `validate_lote_predio_trg` (`043:207-222`): cubre `labores` (valida `lote_id`/`predio_id` vs tenant) — pero el frontend nunca setea `lote_id` (siempre NULL → trigger no-op).
- `audit_*_trigger` (`022:311-317`): solo `trabajadores` entre TH (más lotes/maquinaria/inventario/aplicaciones/cosechas/monitoreos). `cuadrillas/labores/nominas/cursos/registros/puentes` **sin auditoría server** en diseño.
- `current_company()` final (`043:16-27`): retorna NULL sin JWT (fail-closed, revoca anon); `021:7-20` traía fallback semilla — **el efectivo depende de migraciones aplicadas en vivo** (verificar, no asumir).
- `044`: endurece `audit_logs` (inmutable); no añade auditoría TH.

## 7. Grafo relacional actual (verificado)

```text
companies
 │ CASCADE ×8
 ▼
trabajadores ──CASCADE──▶ cuadrilla_miembros ◀──CASCADE── cuadrillas
 │  CASCADE                                    │ SET NULL
 │  ┌──────────▶ labor_trabajadores ◀──CASCADE──┤ labores (lote_id ─SET NULL─▶ lotes; cuadrilla_id ◀ SET NULL cuadrillas)
 │  │            (PK doble, company propio)
 │  ├──────────▶ nominas (snapshot económico, FK NULLable)
 │  └──────────▶ registros_formacion ──▶ cursos_formacion
 │  └──────────▶ bodegas.responsable_id (SET NULL, único FK entrante externo)
 └──∅──▶ profiles/company_users/roles (SIN arista: ver §10)
TEXT sin FK: cosechas.responsable_id, traceability_events.executor_id, maquinaria operador (snapshot 054)
```

## 8. Empresa / tenant (A3.5-respuesta)

`company_id NOT NULL FK CASCADE` en las 8: pertenencia empresarial **modelada**. Puentes con `company_id` propio (no derivado): redundante pero consistente con el enforcement (RLS + trigger por tabla). Formalmente:

```text
ENTIDAD TENANT (company_id NOT NULL) → HIJA (company_id propio) → PUENTE (company_id propio)
¿derivable? SÍ vía FKs (labor→company + trabajador→company). ¿defecto? NO en DDL; SÍ en enforcement cliente (proxy no lo inyecta → depende del trigger server).
```

Riesgo residual aunque el trigger exista: fila puente con `company_id` de A uniendo labor de A + trabajador de B **pasa RLS de puente** (su `company_id`=A) — sin trigger/FK compuesta que exija coherencia triangular. A verificar en A8/A-negativas.

## 9. Predio (A3.6-respuesta, sin proponer diseño)

| Entidad | `predio_id`/`lote_id` | Lectura dominio |
| --- | --- | --- |
| Trabajador | no | vínculo laboral general; asignar predio fijo contradice cuadrillas multi-frente |
| Cuadrilla | no | unidad móvil entre predios |
| Labor | `lote TEXT` + `lote_id NULL` nunca seteado | **única con vocación predial**; hoy `lote` es texto libre → sin aislamiento ni FK efectiva |
| Labor-trabajador | no (hereda vía labor) | depende de formalizar labor→lote |
| Nómina/curso | no | empresariales |
| Registro formación | no | depende contexto; hoy empresarial |

Conclusión A3: el dominio TH está **desconectado del grafo predio/lote** salvo un `lote_id` decorativo. Trazabilidad trabajador→predio hoy solo reconstruible por texto (`labores.lote`).

## 10. Usuario ↔ trabajador (A3.4-respuesta)

**Estado B (incompleto) + D (lógica solo en frontend por nombre).** Evidencia: sin columna/FK en ninguna dirección (`§2`: trabajadores sin `user_id`; `profiles`/`company_users` sin `trabajador_id`); `bootstrap_user_org` (`025`) crea perfil+empresa+membresía, jamás trabajador; notas `052/054` lo declaran; consumos por nombre (`operation.repository.js:64-72`) y por estado-texto. No hay identificador indirecto (emails/documentos no cruzados en DB).
Consecuencias: sin login de trabajador, sin autoservicio, sin `created_by` ejecutora, sin RBAC por cuadrilla, sin auditoría "quién operó" (solo "qué clerk editó", y solo en `trabajadores` si el trigger vive).

## 11. Taxonomías (permitido DB / producido UI / consumido servicio / mostrado)

| Entidad | DB CHECK | UI produce | Service | Mostrado/filtrado | Brecha |
| --- | --- | --- | --- | --- | --- |
| trabajador.estado | Activo,Activa,Inactivo,Vacaciones,Licencia,On Leave | `Activa` (WorkerForm default) | toggle `Activa→On Leave→Inactivo` | badge 3 estados; cuenta `Activa`; harvest filtra `Activo` | 6 permitidos vs 3 usados; `Activo≠Activa` entre módulos |
| trabajador.tipo_contrato | 9 (026) | `Permanente,Temporal,Contrato,Cosecha` (TIPOS_CONTRATO) | passthrough | filtro por esos 4 | OK tras parche; 5 legales sin UI |
| labor.estado | Pendiente,En Progreso,Completada,Cancelada | `Pendiente,En Curso,Completada` + `Archivada` | `Archivada` en archive; `Completada` en unarchive (HistorialTable:174) | Kanban 3 columnas; historial solo `Archivada` | `En Curso` y `Archivada` inválidos; `En Progreso/Cancelada` sin UI |
| nomina.estado | Pendiente,Pagado,Procesado | `Procesando,Completado,Fallido,Vencida` | passthrough | KPIs esos 4 | **0% coincidencia** |
| nomina.periodo | VARCHAR libre (ej. `2026-07`) | `Enero..Mayo` (nombres) | passthrough | selector 5 meses 2026 | formato incompatible con ejemplo DB |
| curso.tipo | 5 fitosanitarios | `Seguridad y Salud,Técnica,Operación` | passthrough | filtro esos 3 | 2/3 inválidos |
| registro.estado | Aprobado,Reprobado,Asistió,Pendiente | `Completada,En Curso,Vencida` | `Completada`→cert | filtros esos 3; stats `Completada` | **0% coincidencia** |
| rol (trabajador) | texto libre | 10 ROLES | passthrough | KPIs 3 roles + Otros; bulk paga por 2 roles | rol operativo ≠ rol acceso (homonimia `Supervisor`) |

## 12. Nómina — modelo económico actual (A3.8)

```text
trabajador (SIN salario base) ──rol──▶ [bulk: salario presunto hardcodeado useNominas.js:91]
NominaModal captura: salarioNeto (digitado) + horasExtras + valorHoraExtra (EFÍMERO, no columna) + retenciones
  → service calcula total_neto = salario + horas*valorHoraExtra − retenciones (nominas.service.js:40,77)
  → INSERT {trabajador_id,periodo,salario_neto,horas_extras,retenciones,total_neto,estado,fecha_pago,metodo_pago,comentarios}
DB guarda snapshot sin fórmula ni tasa; CHECK solo >=0; periodo texto mes; estado incompatible (§11).
```

Almacena: 3 inputs + total + estado/periodo/pago. Calcula (cliente): total. No almacena: tasa hora-extra, fórmula, salario contractual, devengado/deducción desagregados. Modificable por cliente: **todo** (cualquier rol tenant por RLS). Dependencia rol: solo bulk (presuntos) — el individual lo digita quien liquida (NominaModal:39-41 declara "sin salarios presuntos", pero el bulk los usa).

## 13. Integridad referencial (qué hace la BD al borrar)

| Borrado | Efecto DB | Efecto funcional |
| --- | --- | --- |
| Trabajador | CASCADE a puentes + nominas + registros; SET NULL en bodegas | **nóminas y formación históricas se pierden**; bodega queda sin responsable |
| Cuadrilla | CASCADE miembros; labores quedan (`cuadrilla_id→NULL`) | labores huérfanas de cuadrilla, asignaciones individuales intactas |
| Labor | CASCADE `labor_trabajadores` | trazabilidad de participantes borrada |
| Curso | CASCADE registros | certificaciones borradas |
| Empresa | CASCADE todo TH | correcto tenant-drop |
| Lote | `labores.lote_id→NULL`, `lote TEXT` intacto | labor conserva texto pero pierde vínculo formal |

Borrar ≠ retirar: `trabajadores` tiene `deleted_at/deleted_by` pero **ningún service los usa** (delete físico directo) y RLS trata `deleted_at` solo en SELECT (021:146-159), no hay flujo soft-delete.

## 14. Normalización / single source of truth

- Identidad (nombres/documento/rol/contrato): SSOT `trabajadores` (nóminas referencian por FK + join, no duplican — bien).
- Salario: **sin SSOT** (no existe en trabajador; cada nómina es snapshot digitado/presunto; tasa efímera).
- Estado/contrato/tipo: SSOT DB CHECK, pero UI habla otro idioma (§11).
- Asignación: doble vía redundante (`labores.cuadrilla_id` + `labor_trabajadores`) sin constraint que impida ambas a la vez ni que exija una.
- Lote: doble columna (`lote TEXT` usado + `lote_id` muerto) — desnormalización sin sincronía.
- Documentos: foto/cert en columnas base64 (duplican lo que debería ser storage con referencia).

## 15. Dependencias externas (DDL)

Entrante real: `bodegas.responsable_id → trabajadores.id SET NULL` (`011:15`) — borrar trabajador decapita responsabilidad de bodega sin aviso. Salientes: ninguna desde TH hacia operaciones (TH no referencia lotes/predios/maquinaria/cosecha salvo `labores.lote_id` muerto). Referencias TEXT sin FK (§7) son convenciones, no integridad.

## 16. Hallazgos A3 (observación → evidencia → impacto)

- OBS-A3-01 CHECKs incompatibles con UI en 4/8 tablas (nóminas y registros 0%) → escrituras condenadas al rechazo o a vivir fuera de CHECK → P0 funcional (provisional; severidad definitiva con sonda viva).
- OBS-A3-02 `026` legaliza frontend en vez de modelar dominio → deuda taxonómica institucionalizada → P1.
- OBS-A3-03 Sin `updated_at`/actor en 7/8; auditoría server solo `trabajadores` → trazabilidad laboral imposible → P1.
- OBS-A3-04 FKs NULLables (`registros.trabajador_id/curso_id`, `nominas.trabajador_id`) permiten filas huérfanas → P1.
- OBS-A3-05 Sin UNIQUE anti-doble-nómina / sin constraint asignación exclusiva / lote dual → integridad débil → P1/P2.
- OBS-A3-06 `company_id` en puentes existe en DDL + trigger autofill en archivo → el P0 A0/A1 se **reformula**: no es ausencia de modelado sino dependencia del trigger server + incoherencia triangular posible → P0 potencial (requiere sonda viva).
- OBS-A3-07 Sin salario base ni tasa persistida → modelo económico sin fundamento → P0/P1 (seguridad).
- OBS-A3-08 Grafo predio/lote decorativo (`lote_id` muerto, `lote` texto) → sin aislamiento predial posible hoy → P1 (alcance).
- OBS-A3-09 `deleted_at` muerto + CASCADE destructor en historial salarial/formativo → borrado físico con pérdida histórica → P1.

## 17. Riesgos y puerta a A4-A6

A3 confirma la hipótesis estratégica: TH necesita **saneamiento estructural** (taxonomías, identidad trabajador, modelo nómina, lifecycle borrar-vs-retirar, formalizar labor→lote) antes de aplicar el patrón `RPC/service-layer` de Maquinaria — el patrón sigue válido como destino, pero hoy no hay invariantes que encapsular. `--live` BLOQUEADO; NO CERTIFICADO. Siguiente: A4 identidad trabajador/usuario (profundizar §10 con `profiles/company_users/roles` vivos en lectura).
