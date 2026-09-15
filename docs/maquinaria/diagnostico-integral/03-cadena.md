# F03/F04 — Cadena UI→Backend→Supabase y confianza

```text
UI (hook→service→repository)
 ↓  supabase proxy (lib/supabaseClient.js:78-135)
Backend :3000 /api/rest/v1|/api/rpc  (+ inyección cliente company_id en select/update/delete/insert)
 ↓  legacy.js:163-247 (JWT backend→reenvío; Clerk→mint 15min; sin token→anon en dev, 401 en prod)
Supabase PostgREST (RLS por JWT: org_id=company UUID, sub=clerk_user_id)
 ↓  policies / triggers / RPC(INVOKER|DEFINER con asserts internos)
Tablas + maquinaria_eventos + process_audit_log
```

## Confianza (veredicto por capa)

- **Cliente NO es frontera (correcto por diseño):** el proxy de tenant
  (`supabaseClient.js:83-127`) es UX/defensa-en-profundidad; la seguridad real es
  RLS + RPC con `current_company()` del JWT, nunca del payload. `company_id` del
  body es reescrito por trigger `secure_company_id` (cuando exista, H-06).
- **`rpc` NO pasa por el filtro cliente** (proxy solo intercepta `from`):
  bien — las RPC derivan empresa del JWT (`v_c := current_company()`, 052:451+).
- **H-03 P1:** `mintSupabaseToken` (`legacy.js:138-144`) selecciona columna
  `company_users.role` inexistente (42703 verificado) → todo token Clerk directo
  cae a anon (vacío) en vez de JWT. La ruta viva `/api/auth/me`
  (`SupabaseAuthRepository.js:98`: `role_id || role`) sí tolera el esquema.
- **H-10 P2:** en dev, Clerk inválido cae a `jwt.decode` sin verificar
  (`legacy.js:216-218`); en prod rechaza (401). Aceptable solo con
  `NODE_ENV=production` real en despliegue + secretos obligatorios
  (`requireSecret` lanza en prod — bien).
- **Sin fuga de service_role al navegador** (grep limpio en `apps/web/src`).
- **Grants 052 correctos en archivo:** `REVOKE ... FROM PUBLIC, anon` +
  `GRANT EXECUTE ... TO authenticated` por función; DEFINER solo donde escribe
  evento+estado con asserts internos (v2, horómetro) y `search_path` fijo.
