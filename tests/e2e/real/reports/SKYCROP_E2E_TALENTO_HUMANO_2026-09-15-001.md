# E2E Talento Humano — E2E-REAL-2026-09-15-001

Entorno: test · live

TOTAL 17 · PASS 15 · FAIL 2 · P0 2 · P1 0 · 88.2%

| ID | Sev | Expect | Result | Detalle |
|---|---|---|---|---|
| TH-SETUP | P3 | ALLOW | PASS | A=6ffd13b6-e541-406f-9808-7b3283752ee1 B=a13e59ec-b522-4c27-83d4-1f228b59b460 snapshot={"trabajadores":2,"labores":0,"nominas":0,"cursos_formacion":0,"registros_formacion":0,"cuadrillas":0,"labor_trabajadores":-1,"cuadrilla_miembros":-1} |
| TH-001 | P0 | DENY | PASS | anon=200/0 exp=401 bad=401 |
| TH-002 | P1 | ALLOW+DENY | PASS | create=201 bad-estado=400 |
| TH-003 | P1 | ALLOW | PASS | create=201 archive=204 |
| TH-004 | P2 | ALLOW | PASS | toggle=204 |
| TH-005 | P1 | ALLOW | PASS | del=204 op-ve=0 admin-ve=1 reac=204 |
| TH-006 | P0 | ALLOW+DENY | PASS | cua=201 ok=201 cross=403 |
| TH-007 | P0 | DENY | PASS | lote-ajeno=403 |
| TH-008 | P0 | ALLOW+DENY | PASS | ok=201 cross=403 {"code":"42501","details":null,"hint":null,"message":"Labor 9737c956-2310-46b9-b5f4-56aebd369435 no pertenece a la empre |
| TH-009 | P0 | DENY | PASS | ext-trab=1 ext-labA=0 |
| TH-010 | P0 | ALLOW+DENY | PASS | admin=201/2010000 doble=409 oper=403 sup=201 |
| TH-011 | P1 | ALLOW+DENY | PASS | cur=201 reg=201 bad=400 |
| TH-012 | P2 | ALLOW | PASS | create=201 op-ve=1 |
| TH-013 | P0 | ALLOW+DENY | FAIL | sup-edit=204 op-del=204 |
| TH-014 | P0 | DENY | PASS | anon=401 forgery=400 |
| TH-015 | P1 | ALLOW | PASS | audit=3 created_by=e2e_th_admin_001 |
| TH-016 | P0 | ALLOW | FAIL | trabajadores:3 labores:1 nominas:0 cursos_formacion:0 registros_formacion:0 cuadrillas:1 labor_trabajadores:0 cuadrilla_miembros:0 coB-gone=false |

**NO CERTIFICADO**