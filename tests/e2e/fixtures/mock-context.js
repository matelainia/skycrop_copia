/**
 * SKYCROP E2E — Mock factory: contexto empresarial sintético completo (spec §4).
 *
 *   Empresa E2E SkyCrop (TEST_COMPANY)
 *   ├── Predio A (TEST_FARM_A): Lote 01, 02, 03
 *   ├── Predio B (aislamiento): Lote 04
 *   └── Usuarios: operario / supervisor / administrador (+ empresa B para cross-tenant)
 *
 * En modo real los IDs se reemplazan por UUIDs de Supabase; en dry-run son estables.
 */
import { uid, tagTestRun } from '../helpers/mem-store.js';

export function buildMockContext(ctx) {
  const runId = ctx.runId;
  const short = runId.slice(-3);

  const companyA = {
    id: `test-company-a-${short}`,
    clerk_org_id: `org_e2e_a_${short}`,
    nombre: `Empresa E2E SkyCrop ${runId}`,
    metadata: { test_run_id: runId, e2e_synthetic: true }
  };
  const companyB = {
    id: `test-company-b-${short}`,
    clerk_org_id: `org_e2e_b_${short}`,
    nombre: `Empresa E2E Aislamiento ${runId}`,
    metadata: { test_run_id: runId, e2e_synthetic: true }
  };
  const farmA = {
    id: `test-farm-a-${short}`,
    company_id: companyA.id,
    nombre: `Predio A E2E ${runId}`,
    metadata: { test_run_id: runId }
  };
  const farmB = {
    id: `test-farm-b-${short}`,
    company_id: companyB.id,
    nombre: `Predio B (otra empresa) ${runId}`,
    metadata: { test_run_id: runId }
  };
  const lotsA = [1, 2, 3].map((n) => ({
    id: `test-lot-a0${n}-${short}`,
    company_id: companyA.id,
    farm_id: farmA.id,
    codigo_interno: `E2E-L0${n}`,
    nombre: `Lote 0${n} E2E`,
    metadata: { test_run_id: runId }
  }));
  const lotB = {
    id: `test-lot-b04-${short}`,
    company_id: companyB.id,
    farm_id: farmB.id,
    codigo_interno: 'E2E-L04',
    nombre: 'Lote 04 (aislado)',
    metadata: { test_run_id: runId }
  };

  const users = {
    operario: { userId: `user_e2e_operario_${short}`, email: `operario.${short}@e2e.skycrop.test`, role: 'operario', company_id: companyA.id, farm_id: farmA.id },
    supervisor: { userId: `user_e2e_supervisor_${short}`, email: `supervisor.${short}@e2e.skycrop.test`, role: 'supervisor', company_id: companyA.id, farm_id: farmA.id },
    administrador: { userId: `user_e2e_admin_${short}`, email: `admin.${short}@e2e.skycrop.test`, role: 'administrador', company_id: companyA.id, farm_id: farmA.id },
    fantasmaB: { userId: `user_e2e_b_${short}`, email: `externo.${short}@e2e.skycrop.test`, role: 'operario', company_id: companyB.id, farm_id: farmB.id }
  };

  ctx.ctx.companyA = companyA;
  ctx.ctx.companyB = companyB;
  ctx.ctx.farmA = farmA;
  ctx.ctx.farmB = farmB;
  ctx.ctx.lotsA = lotsA;
  ctx.ctx.lotB = lotB;
  ctx.ctx.users = users;

  if (ctx.dryRun) {
    ctx.mem.companies.set(companyA.id, companyA);
    ctx.mem.companies.set(companyB.id, companyB);
    ctx.mem.farms.set(farmA.id, farmA);
    ctx.mem.farms.set(farmB.id, farmB);
    for (const l of [...lotsA, lotB]) ctx.mem.lots.set(l.id, l);
  }
  return ctx.ctx;
}

/** Payloads operacionales del recorrido (Día 2-7), todos etiquetados con TEST_RUN_ID. */
export function buildJourneyPayloads(ctx) {
  const { companyA, farmA, lotsA, users } = ctx.ctx;
  const R = (p) => tagTestRun(p, ctx.runId);
  const lot1 = lotsA[0].id;
  const lot2 = lotsA[1]?.id || lot1;
  return {
    labor: R({
      table: 'programaciones', module: 'labores',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot1,
      titulo: 'Labor E2E: preparación + siembra',
      estado: 'ASIGNADA',
      assigned_to: users.operario.userId,
      metadata_estado: { flujo: ['ASIGNADA', 'ACEPTADA', 'INICIADA', 'EJECUTADA', 'FINALIZADA'] }
    }),
    maquinaria: R({
      table: 'maquinaria_ops', module: 'maquinaria',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot1,
      equipo: 'Tractor E2E-01', horas_uso: 3.5, operador: users.operario.userId
    }),
    aplicacion: R({
      table: 'aplicaciones', module: 'aplicaciones',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot1,
      producto: 'Urea 46-0-0', dosis: 120, unidad: 'kg/ha', area_ha: 2.5,
      operador: users.operario.userId,
      latitud: 3.4516, longitud: -76.3123, precision_gps: 4.2
    }),
    fertilizacion: R({
      table: 'fertilizaciones', module: 'fertilizacion',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot2,
      plan: 'Plan E2E NPK', dosis_n: 120, dosis_p: 40, dosis_k: 60
    }),
    sanitario: R({
      table: 'monitoreos', module: 'sanitario',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot1,
      tipo_monitoreo: 'sanitario', plaga: 'Spodoptera (simulada)', incidencia_pct: 12.5
    }),
    suelo: R({
      table: 'analisis_suelos', module: 'suelos',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot2,
      ph: 5.8, materia_organica_pct: 3.1, textura: 'franco-arcillosa'
    }),
    cosecha: R({
      table: 'cosechas', module: 'cosecha',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot1,
      cantidad_kg: 1250.5, calidad: 'primera', humedad_pct: 12.1
    }),
    venta: R({
      table: 'ventas', module: 'ventas',
      company_id: companyA.id, farm_id: farmA.id, lot_id: lot1,
      comprador: 'Comprador E2E S.A.S.', cantidad_kg: 1200, precio_kg: 2850, total: 3420000
    }),
    factura: R({
      table: 'facturas', module: 'facturacion',
      company_id: companyA.id,
      numero: `E2E-FE-${ctx.runId.slice(-3)}-001`, total: 3420000, estado: 'EMITIDA'
    })
  };
}
