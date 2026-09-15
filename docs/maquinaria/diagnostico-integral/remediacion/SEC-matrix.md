# Batería adversarial SEC-01…SEC-15 — estado y puerta

Leyenda: HECHO-LECTURA = ejecutado en este ciclo (cero escrituras).
APARCADO-LIVE = requiere `--live` (escribe sintético en TEST).

| ID | Prueba | Método | Estado |
| --- | --- | --- | --- |
| SEC-01 | A lee B | JWT org=A SELECT | HECHO-LECTURA PASS (3/0, sin leak, ambos sentidos) |
| SEC-02 | A inserta en B | POST con company B | APARCADO-LIVE (protocolo NEG/REAL-RLS) |
| SEC-03 | A actualiza B | PATCH cross-tenant | APARCADO-LIVE |
| SEC-04 | A borra B | DELETE cross-tenant | APARCADO-LIVE (RLS: solo admin propio) |
| SEC-05 | operador → acción admin | RPC con rol operario | APARCADO-LIVE (`mq_assert_rol`, H-01) |
| SEC-06 | consulta → escritura | rol lectura + POST | APARCADO-LIVE |
| SEC-07 | JWT manipulado | firma inválida | HECHO-LECTURA PASS (401 PGRST301) |
| SEC-08 | org_id manipulado | basura/sin org | HECHO-LECTURA PASS (0 filas, fail-closed) |
| SEC-09 | company_id manipulado (DevTools) | `?company_id=eq.B` con JWT A | HECHO-LECTURA PASS (0 filas; RLS ignora filtro) |
| SEC-10 | maquinaria_id manipulada (IDOR) | GET por id ajeno | HECHO-LECTURA PASS (0 filas) |
| SEC-11 | RPC directa | anon + JWT sin tenant | HECHO-LECTURA parcial (404 superficie ausente); APARCADO-LIVE resto |
| SEC-12 | replay | re-POST mismo body | APARCADO-LIVE (suite sabotaje) |
| SEC-13 | doble jornada | 2 inicios simultáneos | APARCADO-LIVE (índice `uq_mqop_activa_052` + lock en diseño) |
| SEC-14 | estado imposible | transición inválida | APARCADO-LIVE (trigger en diseño; H-04 UI ya normaliza) |
| SEC-15 | histórico modificado | UPDATE/DELETE cerrado | APARCADO-LIVE (trigger `mq_block_historico` en diseño) |

Evidencia lectura: `resondeo-BEFORE.json` (casos SEC-*).
