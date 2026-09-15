# Matriz de permisos — Maquinaria (congelada)

> Normativa junto a `contrato-tecnico.md`. `can()` controla **UX**, nunca seguridad.
> La autorización real vive en **RLS + RPC + grants + triggers**.
> Base: roles `005_roles.sql:13-24`, seed `006_permissions.sql:15-53`.

## 1. Roles canónicos

| Rol | Alcance |
|---|---|
| `super_admin` | Global sistema (no tenant) |
| `gerente` | Todo en su empresa + reportes |
| `administrador` | Administración completa del tenant |
| `ingeniero` | Lotes/cultivos/aplicaciones/monitoreos; maquinaria **lectura** (`006:30`) |
| `supervisor` | Maquinaria **todo** (`006:34`), laboral todo, inventario/lotes lectura |
| `operario` | Maquinaria **leer** (`006:42`) + acciones operativas delegadas abajo |
| `auditor`, `consulta`, `invitado` | Lectura según seed |

## 2. Matriz acción × rol (maquinaria)

| Acción | admin | gerente | supervisor | ingeniero | operario | auditor/consulta |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver flota/KPI/tabla | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (lectura) |
| Registrar maquinaria | ✓ | ✓ | ✓ | — | — | — |
| Editar datos maestros | ✓ | ✓ | ✓ | — | — | — |
| Retirar / Fuera de servicio (+motivo) | ✓ | — | — | — | — | — |
| Rehabilitar Fuera de servicio | ✓ | ✓ | — | — | — | — |
| Iniciar jornada | ✓ | ✓ | ✓ | — | ✓* | — |
| Cerrar jornada propia/asignada | ✓ | ✓ | ✓ | — | ✓* | — |
| Registrar combustible | ✓ | ✓ | ✓ | — | ✓* | — |
| Programar mantenimiento | ✓ | ✓ | ✓ | — | — | — |
| Ejecutar/registrar mantenimiento | ✓ | ✓ | ✓ | — | ✓* | — |
| Corregir horómetro (`modo=correccion`) | ✓ | ✓ | — | — | — | — |
| Ver costos | ✓ | ✓ | ✓ | — | — | — (auditor ✓) |
| Modificar costos/históricos | — | — | — | — | — | — |
| Ver trazabilidad | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alterar trazabilidad/eventos | — | — | — | — | — | — |

`*` operario solo sobre máquinas/jornadas asignadas y con `operador_id` propio;
el tenant y la asignación los valida la RPC, no la UI.

## 3. Mapeo `can()` → UI (UX únicamente)

```ts
can("maquinaria.create")     // registrar
can("maquinaria.update")     // editar maestros
can("maquinaria.delete")     // retirar (solo admin; con motivo)
can("maquinaria.operate")    // iniciar/cerrar jornada
can("maquinaria.fuel")       // registrar combustible
can("maquinaria.maintenance")// programar/ejecutar
can("maquinaria.costs.read") // ver costos
can("maquinaria.horometro.correct") // corrección (admin/gerente)
```

```tsx
{can("maquinaria.create") && (<RegistrarMaquinariaButton />)}
```

Implementación: resolver contra `company_users(rol)` + `permisos(recurso='maquinaria')`,
nunca contra flags del cliente. Estado actual a reemplazar:
`modules/maquinaria/permissions/can*.js` (`return true` mock).

## 4. Enforcement real (qué bloquea cada capa)

| Intento hostil | RLS | RPC | Trigger/CHECK |
|---|---|---|---|
| Leer otra empresa | `USING company=current_company()` DENY | `EXISTS(...company)` DENY | — |
| `INSERT` con `company_id` ajeno | `WITH CHECK` DENY | `v_company` del JWT, ignora body | `secure_company_id_trg` corrige/bloquea + `FORGERY_ATTEMPT` |
| Cambiar `estado` por PostgREST | policy sin `estado` + trigger rechaza | solo RPC DEFINER muta estado | CHECK transiciones §3 |
| Doble jornada simultánea | — | transacción + `FOR UPDATE` | `UNIQUE ... WHERE En Progreso` |
| Horómetro regresivo | — | `HOROMETRO_REGRESIVO` | `CHECK hor_fin ≥ hor_ini` |
| UPDATE/DELETE evento o histórico | sin policy UPDATE/DELETE | no expone vía | `RAISE EXCEPTION HISTORICO_INMUTABLE` |
| Ejecutar RPC sin rol | — | `current_role_id()` + DENY | — |
| `anon`/sin JWT | sin policy `TO anon` | `current_company()` demo/NULL sin datos | — |
| `PUBLIC` ejecuta RPC sensible | `REVOKE FROM PUBLIC` en cada función | `GRANT EXECUTE TO authenticated` únicamente | — |

`service_role`: solo backend/server, bypass RLS. Nunca en navegador.
