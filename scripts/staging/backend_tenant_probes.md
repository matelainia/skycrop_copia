# Probes manuales backend en staging (sesión Clerk real)

> El backend deriva el tenant del token Clerk (`req.tenant`). No se puede
> falsificar sin una sesión real: estas probes se ejecutan con el token de un
> usuario A de staging (DevTools → `getToken()`), contra el backend apuntando
> a staging. `TOKEN_A` = JWT de sesión Clerk del usuario A (empresa A).

## 1. Fertilización ignora company_id ajeno

```bash
curl -s -X POST $BACKEND/api/v1/fertilizacion/planes \
  -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
  -d '{"company_id":"<UUID_EMPRESA_B>","name":"Probe","lote_id":"<LOTE_B>"}'
# Esperado: 401/403 o plan creado bajo la empresa A (nunca B).
# Verificar en BD: SELECT company_id FROM fertilization_plans ORDER BY created_at DESC LIMIT 1;
```

## 2. Evaluaciones: draft con companyId=B se reclasifica a A

```bash
curl -s "$BACKEND/api/v1/evaluaciones/draft/<LOTE_A>?companyId=<UUID_EMPRESA_B>" \
  -H "Authorization: Bearer $TOKEN_A"
# Esperado: draft de A o vacío. Nunca datos de B.
```

## 3. Cosechas: trazabilidad de código B con token A

```bash
curl -s "$BACKEND/api/v1/cosechas/trazabilidad?codigo=<CODIGO_COS_B>" \
  -H "Authorization: Bearer $TOKEN_A"
# Esperado: error o vacío. Nunca el árbol de B.
```

## 4. Productos: ficha de producto exclusivo de B

```bash
curl -s "$BACKEND/api/v1/productos/9000001" -H "Authorization: Bearer $TOKEN_A"
# Esperado: 404 (inexistente para este tenant).
```

## 5. Auditoría: mutación sin tenant válido no deja evento huérfano

```bash
curl -s -X POST $BACKEND/api/v1/fertilizacion/planes/xxx/completar \
  -H 'Content-Type: application/json' -d '{}'
# Esperado: 401 (requireAuth). Y: SELECT COUNT(*) FROM audit_logs
# WHERE company_id IS NULL; → 0 (el middleware descarta sin tenant).
```

Cada probe: anotar request, status, evidencia en BD. Cualquier dato de B
visible/creado desde A = escape = compuerta cerrada.
