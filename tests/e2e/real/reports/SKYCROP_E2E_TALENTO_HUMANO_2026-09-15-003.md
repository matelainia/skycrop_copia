# E2E Talento Humano — E2E-REAL-2026-09-15-003

Entorno: test · live

TOTAL 20 · PASS 20 · FAIL 0 · P0 0 · P1 0 · 100.0%

| ID | Sev | Expect | Result | Detalle |
|---|---|---|---|---|
| TH-SETUP | P3 | ALLOW | PASS | A=6ffd13b6-e541-406f-9808-7b3283752ee1 B=11111111-1111-4111-8111-111111111111 snapshot={"trabajadores":2,"labores":0,"nominas":0,"cursos_formacion":0,"registros_formacion":0,"cuadrillas":0,"labor_trabajadores":0,"cuadrilla_miembros":0} |
| TH-001 | P0 | DENY | PASS | anon=200/0 exp=401 bad=401 |
| TH-002 | P1 | ALLOW+DENY | PASS | create=201 bad-estado=400 |
| TH-003 | P1 | ALLOW | PASS | create=201 archive=204 |
| TH-004 | P2 | ALLOW | PASS | toggle=204 |
| TH-005 | P1 | ALLOW | PASS | del=204 op-ve=0 admin-ve=1 reac=204 |
| TH-006 | P0 | ALLOW+DENY | PASS | cua=201 ok=201 cross=403 |
| TH-007 | P0 | DENY | PASS | lote-ajeno=403 |
| TH-008 | P0 | ALLOW+DENY | PASS | ok=201 cross=403 {"code":"42501","details":null,"hint":null,"message":"Labor 33333333-3333-4333-8333-333333333333 no pertenece a la empre |
| TH-009 | P0 | DENY | PASS | ext-trab=0 ext-labA=0 |
| TH-010 | P0 | ALLOW+DENY | PASS | admin=201/2010000 doble=409 oper=403 sup=201 |
| TH-011 | P1 | ALLOW+DENY | PASS | cur=201 reg=201 bad=400 |
| TH-012 | P2 | ALLOW | PASS | create=201 op-ve=1 |
| TH-013 | P0 | ALLOW+DENY | PASS | sup-edit=204 op-del=200/[] intacto=true |
| TH-014 | P0 | DENY | PASS | anon=401 forgery=400 |
| TH-015 | P1 | ALLOW | PASS | audit=3 created_by=e2e_th_admin_003 |
| TH-RPC-01 | P0 | ALLOW | PASS | cua=200 lab=200 atomica=true |
| TH-RPC-02 | P0 | ALLOW | PASS | rpc=200 total=1580000 |
| TH-RPC-03 | P0 | DENY | PASS | oper-retirar=403 anon=401 |
| TH-016 | P0 | ALLOW | PASS | trabajadores:2 labores:0 nominas:0 cursos_formacion:0 registros_formacion:0 cuadrillas:0 labor_trabajadores:0 cuadrilla_miembros:0 lotes-gone=true |

**FASE 1 VERIFICADA E2E** (pendiente Fase 2 para certificación global)