# F12 — Certificación interina: NO CERTIFICADO

P0 abiertos: 2 (H-01, H-02). P1 abiertos: 4 (H-03…H-06). Criterio §39/§41 exige
0 P0 (+ 0 P1 seguridad en módulos con trazabilidad): **no se certifica**.

## Lo demostrado (con evidencia)

- Aislamiento tenant en lectura, fail-closed, anon vacío, firma inválida 401.
- Diseño 052 sólido: INVOKER+`search_path`, asserts tenant/rol/estado/horómetro,
  lock `FOR UPDATE`, índice único anti-doble-jornada, append-only, vistas
  `security_invoker`, postflight y rollback documentados.
- Cadena real identificada (proxy + mint + RLS) sin fuga de service_role.

## Puerta de certificación (todo obligatorio)

1. Dashboard según `05-hallazgos.md` + verificación:
   ```sql
   select proname from pg_proc where pronamespace='public'::regnamespace
     and proname in ('registrar_maquinaria','iniciar_jornada_maquinaria',
     'finalizar_jornada_maquinaria','registrar_combustible_maquinaria',
     'programar_mantenimiento_maquinaria','registrar_mantenimiento_maquinaria_v2',
     'actualizar_horometro_maquinaria','registrar_incidencia_maquinaria',
     'registrar_costo_lote','process_audit_log','process_secure_company_id');
   select tgname from pg_trigger where tgname like 'mq_%' or tgname like 'audit_mq%';
   ```
2. Correcciones H-03, H-04, H-05 (código) + re-deploy backend/web.
3. Re-sondeo testigos en verde.
4. `--live --env=test` (Paso 10): 0 P0/P1 → certificación.
5. Escrituras adversariales + concurrencia + rendimiento quedan cubiertas por
   el harness `--live` (suites sabotaje/concurrencia + protocolo 40 casos).
