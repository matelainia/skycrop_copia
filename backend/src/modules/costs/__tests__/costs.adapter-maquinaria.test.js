import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Adaptador Maquinaria 067 contra dev (§7). Solo corre con:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Sin env → skip. Crea empresa + maquinaria + operaciones temporales y las borra.
 * NOTA: los triggers se disparan con UPDATE/INSERT directos (service_role);
 * la RPC finalizar_jornada_maquinaria exige JWT de usuario (INVOKER) y se
 * valida manual según runbook §10.2/§10.4.
 */
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(URL && KEY);
const runIfEnv = hasEnv ? describe : describe.skip;

let sb = null;
let companyId = null;
let loteId = null;
let maqId = null;
let op1Id = null;
let fuel1Id = null;

const RATES = { op: 10000, fuel: 8000, mant: 5000, depr: 3000 };

runIfEnv('costos — adaptador maquinaria 067 en dev', () => {
  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    sb = createClient(URL, KEY);
    const tag = Date.now().toString(36);
    const { data: c, error: e1 } = await sb
      .from('companies')
      .insert([{ clerk_org_id: `draft-costos-mq-${tag}`, nombre: `DRAFT COSTOS MQ ${tag}` }])
      .select('id')
      .single();
    if (e1) throw e1;
    companyId = c.id;
    const { data: p } = await sb
      .from('predios')
      .insert([{ company_id: companyId, nombre: 'Predio draft' }])
      .select('id')
      .single();
    const { data: l, error: e2 } = await sb
      .from('lotes')
      .insert([
        {
          company_id: companyId,
          predio_id: p.id,
          codigo_interno: `DRAFTMQ-${tag}`,
          nombre: 'Lote draft',
          cultivo: 'Maíz',
          area_ha: 10
        }
      ])
      .select('id')
      .single();
    if (e2) throw e2;
    loteId = l.id;
    const { data: m, error: e3 } = await sb
      .from('maquinaria')
      .insert([
        {
          company_id: companyId,
          codigo_id: `TST-${tag}`,
          codigo: `TST-${tag}`,
          name: 'Tractor test',
          nombre: 'Tractor test',
          type: 'Tractor',
          tipo: 'Tractor',
          status: 'Disponible',
          estado: 'Disponible',
          hours_of_operation: 100,
          horometro_actual: 100,
          hours_today: 0,
          fuel_consumption: '0 L/h',
          last_maintenance: new Date().toISOString().slice(0, 10),
          next_maintenance: new Date().toISOString().slice(0, 10),
          cost_operator: RATES.op,
          cost_fuel: RATES.fuel,
          cost_maintenance: RATES.mant,
          cost_depreciation: RATES.depr,
          costo_operador_hora: RATES.op,
          costo_combustible_hora: RATES.fuel,
          costo_mantenimiento_hora: RATES.mant,
          costo_depreciacion_hora: RATES.depr
        }
      ])
      .select('id')
      .single();
    if (e3) throw new Error(`maquinaria: ${e3.message}`);
    maqId = m.id;
  }, 30000);

  afterAll(async () => {
    // Limpieza en orden: el guard bloquea DELETE de fuentes costeadas (§2 runbook).
    if (sb && companyId) {
      await sb.from('costos_entradas').delete().eq('company_id', companyId);
      await sb.from('costos_eventos').delete().eq('company_id', companyId);
      await sb.from('costos_issues').delete().eq('company_id', companyId);
      await sb.from('traceability_events').delete().eq('company_id', companyId);
      await sb.from('companies').delete().eq('id', companyId);
    }
  });

  async function finalizeOp({ lote, horas = 8, combustible = 20 }) {
    const t0 = new Date(Date.now() - horas * 3600 * 1000).toISOString();
    const { data: op, error: e1 } = await sb
      .from('maquinaria_operaciones')
      .insert([
        {
          company_id: companyId,
          maquinaria_id: maqId,
          operador_nombre: 'Test',
          labor: 'Rastra',
          lote_id: lote,
          lote_nombre: lote ? 'Lote draft' : 'Sin lote',
          inicio: t0,
          horometro_inicio: 100,
          estado: 'En Progreso',
          created_by: 'test'
        }
      ])
      .select('id')
      .single();
    if (e1) throw e1;
    const legacyTotal = horas * (RATES.op + RATES.fuel + RATES.mant + RATES.depr);
    const { error: e2 } = await sb
      .from('maquinaria_operaciones')
      .update({
        fin: new Date().toISOString(),
        horometro_fin: 100 + horas,
        horas,
        combustible_l: combustible,
        costo_total: legacyTotal,
        estado: 'Finalizada'
      })
      .eq('id', op.id);
    if (e2) throw e2;
    return { opId: op.id, legacyTotal };
  }

  it('operación con lote → machine_usage posted SIN combustible (fuel_policy separate)', async () => {
    const { opId, legacyTotal } = await finalizeOp({ lote: loteId });
    op1Id = opId;
    expect(legacyTotal).toBe(8 * 26000);
    const { data: ev } = await sb
      .from('costos_eventos')
      .select('*')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', opId)
      .maybeSingle();
    expect(ev.event_type).toBe('machine_usage');
    expect(ev.status).toBe('posted');
    // 8h × (10000+5000+3000): combustible excluido aunque el legacy lo incluya.
    expect(Number(ev.valued_amount)).toBe(8 * 18000);
    expect(Number(ev.amount_base)).toBe(8 * 18000);
    expect(ev.payload.valuation.fuel_policy).toBe('separate');
    expect(ev.payload.legacy_costo_total).toBe(legacyTotal);
    // §9.2: el legacy NO alimenta el ledger.
    // §9.1: declara 20 L sin cargas en ventana → missing_fuel_data.
    expect(ev.payload.fuel_link_available).toBe(false);
    const { data: fiss } = await sb
      .from('costos_issues')
      .select('issue_type')
      .eq('source_event_id', ev.id)
      .eq('status', 'open');
    expect((fiss || []).map((i) => i.issue_type)).toContain('missing_fuel_data');
    const { data: en } = await sb.from('costos_entradas').select('*').eq('source_event_id', ev.id);
    expect(en).toHaveLength(1);
    expect(en[0].cost_class).toBe('machinery_usage');
    expect(en[0].directness).toBe('direct');
    expect(en[0].entry_hash).toBeTruthy();
    expect(Number(en[0].amount_base)).not.toBe(legacyTotal); // §9.2
    // Trazabilidad con lote.
    const { data: trz } = await sb
      .from('traceability_events')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_table', 'maquinaria_operaciones')
      .eq('source_id', opId);
    expect((trz || []).length).toBe(1);
  });

  it('operación sin lote (Q1) → nivel máquina indirecto, jamás a lote', async () => {
    const { opId } = await finalizeOp({ lote: null });
    const { data: ev } = await sb
      .from('costos_eventos')
      .select('*')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', opId)
      .maybeSingle();
    expect(ev.status).toBe('posted');
    expect(ev.lote_id).toBeNull();
    expect(ev.payload.allocation).toMatchObject({
      method: 'direct',
      quality: 'inferred',
      directness: 'indirect'
    });
    const { data: en } = await sb
      .from('costos_entradas')
      .select('directness,lote_id')
      .eq('source_event_id', ev.id);
    expect(en[0].directness).toBe('indirect');
    expect(en[0].lote_id).toBeNull();
    // §9.3: ausente de resúmenes por lote (vista con security_invoker).
    const { data: viewRows } = await sb
      .from('v_costo_lote_resumen')
      .select('lote_id,total')
      .eq('company_id', companyId);
    const withLote = (viewRows || []).filter((r) => r.lote_id !== null);
    expect(withLote).toHaveLength(1);
    expect(withLote[0].lote_id).toBe(loteId);
    expect(Number(withLote[0].total)).toBe(8 * 18000);
  });

  it('carga de combustible → fuel_consumption posted por costo real', async () => {
    const { data: row, error } = await sb
      .from('maquinaria_combustible')
      .insert([
        {
          company_id: companyId,
          maquinaria_id: maqId,
          cantidad: 20,
          unidad: 'L',
          costo_unitario: 4500,
          costo_total: 90000,
          horometro: 108,
          created_by: 'test'
        }
      ])
      .select('id')
      .single();
    if (error) throw error;
    fuel1Id = row.id;
    const { data: ev } = await sb
      .from('costos_eventos')
      .select('*')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_combustible')
      .eq('source_id', row.id)
      .maybeSingle();
    expect(ev.event_type).toBe('fuel_consumption');
    expect(ev.status).toBe('posted');
    expect(Number(ev.amount_base)).toBe(90000);
  });

  it('mantenimiento completado → maintenance_cost posted', async () => {
    const { data: m } = await sb
      .from('maquinaria_mantenimientos')
      .insert([
        {
          company_id: companyId,
          maquinaria_id: maqId,
          tipo: 'Preventivo',
          estado: 'Programado',
          descripcion: 'Cambio aceite test',
          fecha_programada: new Date().toISOString().slice(0, 10),
          horometro: 108,
          created_by: 'test'
        }
      ])
      .select('id')
      .single();
    await sb
      .from('maquinaria_mantenimientos')
      .update({ estado: 'Completado', costo: 75000 })
      .eq('id', m.id);
    const { data: ev } = await sb
      .from('costos_eventos')
      .select('*')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_mantenimientos')
      .eq('source_id', m.id)
      .maybeSingle();
    expect(ev.event_type).toBe('maintenance_cost');
    expect(ev.status).toBe('posted');
    expect(Number(ev.amount_base)).toBe(75000);
  });

  it('§9.1b operación con carga en ventana → sin missing_fuel_data', async () => {
    const t0 = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
    const { data: op } = await sb
      .from('maquinaria_operaciones')
      .insert([
        {
          company_id: companyId,
          maquinaria_id: maqId,
          operador_nombre: 'Test',
          labor: 'Siembra',
          lote_id: loteId,
          lote_nombre: 'Lote draft',
          inicio: t0,
          horometro_inicio: 200,
          estado: 'En Progreso',
          created_by: 'test'
        }
      ])
      .select('id')
      .single();
    await sb.from('maquinaria_combustible').insert([
      {
        company_id: companyId,
        maquinaria_id: maqId,
        cantidad: 15,
        unidad: 'L',
        costo_unitario: 4500,
        costo_total: 67500,
        horometro: 204,
        created_by: 'test'
      }
    ]);
    await sb
      .from('maquinaria_operaciones')
      .update({
        fin: new Date().toISOString(),
        horometro_fin: 208,
        horas: 8,
        combustible_l: 15,
        costo_total: 8 * 26000,
        estado: 'Finalizada'
      })
      .eq('id', op.id);
    const { data: ev } = await sb
      .from('costos_eventos')
      .select('*')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', op.id)
      .maybeSingle();
    expect(ev.status).toBe('posted');
    expect(ev.payload.fuel_link_available).toBe(true);
    const { data: iss } = await sb
      .from('costos_issues')
      .select('id')
      .eq('source_event_id', ev.id)
      .eq('issue_type', 'missing_fuel_data')
      .eq('status', 'open');
    expect(iss).toHaveLength(0);
  });

  it('§9.4 falla del adaptador → operación intacta + issue adapter_failure', async () => {
    const bad = await sb.rpc('costos_adapter_emit', {
      p_company_id: companyId,
      p_user_id: 'test',
      p_payload: {}
    });
    expect(bad.error).toBeNull();
    expect(bad.data.emitted).toBe(false);
    const { data: iss } = await sb
      .from('costos_issues')
      .select('issue_type,severity')
      .eq('company_id', companyId)
      .eq('issue_type', 'adapter_failure')
      .eq('status', 'open');
    expect((iss || []).length).toBeGreaterThanOrEqual(1);
  });

  it('§9.5 cambio post-cierre → issue sin mutar ledger', async () => {
    const { error: u1 } = await sb
      .from('maquinaria_operaciones')
      .update({ horas: 10 })
      .eq('id', op1Id);
    expect(u1).toBeNull();
    const { data: ev } = await sb
      .from('costos_eventos')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', op1Id)
      .maybeSingle();
    const { data: iss } = await sb
      .from('costos_issues')
      .select('issue_type')
      .eq('source_event_id', ev.id)
      .eq('issue_type', 'source_changed_after_post')
      .eq('status', 'open');
    expect((iss || []).length).toBeGreaterThanOrEqual(1);
    const { data: en } = await sb
      .from('costos_entradas')
      .select('entry_kind,amount_base')
      .eq('source_event_id', ev.id)
      .eq('status', 'posted');
    expect(
      en.filter((e) => e.entry_kind !== 'reversal').reduce((a, e) => a + Number(e.amount_base), 0)
    ).toBe(8 * 18000);
  });

  it('§9.6 borrado de fuente costeada → bloqueado', async () => {
    const delFuel = await sb.from('maquinaria_combustible').delete().eq('id', fuel1Id);
    expect(delFuel.error).not.toBeNull();
    expect(delFuel.error.message).toMatch(/source_locked/);
    const delOp = await sb.from('maquinaria_operaciones').delete().eq('id', op1Id);
    expect(delOp.error).not.toBeNull();
    expect(delOp.error.message).toMatch(/source_locked/);
  });

  it('§8 idempotencia: notas no duplican; transición inválida no emite; re-fire no muta', async () => {
    const before = await sb
      .from('costos_eventos')
      .select('id', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', op1Id);
    await sb.from('maquinaria_operaciones').update({ notas: 'ajuste nota' }).eq('id', op1Id);
    const after = await sb
      .from('costos_eventos')
      .select('id', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', op1Id);
    expect(after.count).toBe(before.count);
    // Transición En Progreso → Cancelada no emite costo.
    const { data: opx } = await sb
      .from('maquinaria_operaciones')
      .insert([
        {
          company_id: companyId,
          maquinaria_id: maqId,
          operador_nombre: 'Test',
          labor: 'Prueba',
          lote_id: loteId,
          lote_nombre: 'Lote draft',
          inicio: new Date().toISOString(),
          horometro_inicio: 300,
          estado: 'En Progreso',
          created_by: 'test'
        }
      ])
      .select('id')
      .single();
    await sb.from('maquinaria_operaciones').update({ estado: 'Cancelada' }).eq('id', opx.id);
    const { data: noEv } = await sb
      .from('costos_eventos')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', opx.id);
    expect(noEv).toHaveLength(0);
    // Reapertura con costo vigente → BLOQUEO; vía corrección (reverso) → permitido.
    const { data: ev1 } = await sb
      .from('costos_eventos')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_entity', 'maquinaria_operaciones')
      .eq('source_id', op1Id)
      .maybeSingle();
    const blocked = await sb
      .from('maquinaria_operaciones')
      .update({ estado: 'En Progreso' })
      .eq('id', op1Id);
    expect(blocked.error).not.toBeNull();
    expect(blocked.error.message).toMatch(/source_locked/);
    const rev = await sb.rpc('costos_reverse_event', {
      p_company_id: companyId,
      p_user_id: 'test',
      p_event_id: ev1.id,
      p_reason: 'Corrección prueba reapertura'
    });
    expect(rev.error).toBeNull();
    expect(rev.data.status).toBe('reversed');
    const reopen = await sb
      .from('maquinaria_operaciones')
      .update({ estado: 'En Progreso' })
      .eq('id', op1Id);
    expect(reopen.error).toBeNull();
    const refinal = await sb
      .from('maquinaria_operaciones')
      .update({ estado: 'Finalizada' })
      .eq('id', op1Id);
    expect(refinal.error).toBeNull();
    // Sin reemisión automática en MVP: 1 costo + 1 reverso, neto cero, sin duplicados.
    const { data: en } = await sb
      .from('costos_entradas')
      .select('entry_kind,amount_base,sign')
      .eq('source_event_id', ev1.id);
    expect(en.filter((e) => e.entry_kind === 'cost')).toHaveLength(1);
    expect(en.reduce((a, e) => a + Number(e.amount_base) * e.sign, 0)).toBe(0);
  });

  it('cierre terminal mantenimiento: Completado→En ejecucion bloqueado con costo', async () => {
    const { data: m } = await sb
      .from('maquinaria_mantenimientos')
      .insert([
        {
          company_id: companyId,
          maquinaria_id: maqId,
          tipo: 'Correctivo',
          estado: 'Programado',
          descripcion: 'Falla test',
          fecha_programada: new Date().toISOString().slice(0, 10),
          horometro: 120,
          created_by: 'test'
        }
      ])
      .select('id')
      .single();
    await sb
      .from('maquinaria_mantenimientos')
      .update({ estado: 'Completado', costo: 50000 })
      .eq('id', m.id);
    const back = await sb
      .from('maquinaria_mantenimientos')
      .update({ estado: 'En ejecucion' })
      .eq('id', m.id);
    expect(back.error).not.toBeNull();
    expect(back.error.message).toMatch(/source_locked/);
  });
});
