# Auditoría integral — Maquinaria (Fases 00–12, corte interino)

Rama: `diagnostico/maquinaria-integral`. Regla: **DIAGNÓSTICO ≠ CORRECCIÓN**.
Método: inventario estático (archivos) + sondas **solo-lectura** contra el proyecto
`gynttnymneanbziywqqr` (service_role para testigos, anon y JWT HS256 autofirmados
para pruebas de aislamiento en lectura). **Cero escrituras**: las pruebas de
escritura/sabotaje/concurrencia quedan aparcadas al `--live` (Paso 10).

## Veredictos interinos (sin --live no hay certificación)

| Área | Veredicto | Detalle |
| --- | --- | --- |
| Integridad DB (estática, archivo 052) | DISEÑO PASS | Tablas+RLS+RPC+triggers+vistas bien diseñados en archivo |
| Integridad DB (viva) | **FAIL P0** | H-01/H-02: funciones 052 y 022 ausentes en vivo |
| Frontend ↔ Backend | PASS (lecturas) / **FAIL P0** (escrituras) | Lecturas REST OK; todas las RPC escriben a 404 |
| Backend ↔ Supabase | PASS con H-03/H-10 | Proxy traduce Clerk→JWT y reenvía; RLS aplica |
| RLS lecturas | PASS conductual | Sin leak cross-tenant; fail-closed; anon vacío |
| RBAC escrituras | **FAIL P1** | H-05/H-08: legacy UPDATE sin rol; can() mock |
| Estados | DISEÑO PASS / **FAIL P1** vivo | H-04: trigger sync vs filtros frontend |
| Combustible/Mantenimiento reglas | DISEÑO PASS | Invariantes en RPC (no verificables en vivo) |
| Integración módulos | P2 | H-09: sin FK/UI cosecha↔maquinaria; lote lógico |
| Trazabilidad/inmutabilidad | DISEÑO PASS / **FAIL P1** vivo | H-06: triggers de auditoría ausentes en vivo |
| Adversarial lectura | PASS | anon/IDOR-lectura/firma; escrituras aparcadas |
| Concurrencia/rendimiento | APARCADO | Diseño: lock FOR UPDATE + índice único parcial |
| **CERTIFICACIÓN** | **NO CERTIFICADO** | 2 P0 + 4 P1 abiertos; requiere remediación + --live |

Documentos: `01-inventario.md`, `02-modelo-datos.md`, `03-cadena.md`,
`04-rls-autorizacion.md`, `05-hallazgos.md`, `06-certificacion.md`.
