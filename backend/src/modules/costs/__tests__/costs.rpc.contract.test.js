import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contrato RPC 066 contra dev (§10.3). Solo corre con:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Sin env → skip (CI sin base). Crea empresa/lote temporales y los borra.
 * NOTA: service_role bypasea RLS; el aislamiento entre companies se verifica
 * con backend/scripts/verify-costos-065-066.sql (§10.2) + JWTs manuales.
 */
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(URL && KEY);
const runIfEnv = hasEnv ? describe : describe.skip;

let sb = null;
let companyId = null;
let loteId = null;
const SRC = '11111111-1111-4111-8111-111111111111';

runIfEnv('costos — contrato RPC 066 en dev', () => {
  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    sb = createClient(URL, KEY);
    const tag = Date.now().toString(36);
    const { data: c, error: e1 } = await sb
      .from('companies')
      .insert([{ clerk_org_id: `draft-costos-${tag}`, nombre: `DRAFT COSTOS ${tag}` }])
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
          codigo_interno: `DRAFT-${tag}`,
          nombre: 'Lote draft',
          cultivo: 'Maíz',
          area_ha: 10
        }
      ])
      .select('id')
      .single();
    if (e2) throw e2;
    loteId = l.id;
  }, 30000);

  afterAll(async () => {
    if (sb && companyId) await sb.from('companies').delete().eq('id', companyId);
  });

  it('seeds 065: permisos costos + catálogo de indicadores', async () => {
    const { data: perms } = await sb.from('permisos').select('id').eq('recurso', 'costos');
    expect((perms || []).length).toBeGreaterThanOrEqual(6);
    const { data: defs } = await sb.from('costos_indicadores_def').select('code');
    expect((defs || []).length).toBeGreaterThanOrEqual(16);
  });

  it('register → value → allocate → post → post idempotente → reverse → reverse idempotente', async () => {
    const reg = await sb.rpc('costos_register_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_payload: {
        source_module: 'manual',
        source_entity: 'manual_test',
        source_id: SRC,
        event_type: 'input_consumption',
        occurred_at: new Date().toISOString(),
        lote_id: loteId,
        quantity: 10,
        source_unit: 'kg',
        provided_unit_price: 5000,
        currency: 'COP'
      }
    });
    if (reg.error) throw new Error(`register: ${reg.error.message}`);
    expect(reg.data.status).toBe('received');
    expect(reg.data.created).toBe(true);
    const eid = reg.data.event_id;

    const dup = await sb.rpc('costos_register_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_payload: {
        source_module: 'manual',
        source_entity: 'manual_test',
        source_id: SRC,
        event_type: 'input_consumption',
        occurred_at: new Date().toISOString(),
        lote_id: loteId,
        quantity: 10,
        source_unit: 'kg',
        provided_unit_price: 5000,
        currency: 'COP'
      }
    });
    expect(dup.error).toBeNull();
    expect(dup.data.created).toBe(false);
    expect(dup.data.event_id).toBe(eid);

    const val = await sb.rpc('costos_value_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid
    });
    if (val.error) throw new Error(`value: ${val.error.message}`);
    expect(val.data.status).toBe('priced');
    expect(Number(val.data.amount_base)).toBe(50000);

    const all = await sb.rpc('costos_allocate_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid
    });
    if (all.error) throw new Error(`allocate: ${all.error.message}`);
    expect(all.data.quality).toBe('direct');

    const post1 = await sb.rpc('costos_post_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid
    });
    if (post1.error) throw new Error(`post: ${post1.error.message}`);
    expect(post1.data.posted).toBe(true);
    expect(post1.data.entries).toHaveLength(1);

    const post2 = await sb.rpc('costos_post_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid
    });
    expect(post2.error).toBeNull();
    expect(post2.data.posted).toBe(false);

    const rev1 = await sb.rpc('costos_reverse_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid,
      p_reason: 'Prueba automatizada draft'
    });
    if (rev1.error) throw new Error(`reverse: ${rev1.error.message}`);
    expect(rev1.data.status).toBe('reversed');
    expect(rev1.data.reversal_entries).toBe(1);

    const rev2 = await sb.rpc('costos_reverse_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid,
      p_reason: 'Prueba automatizada draft'
    });
    expect(rev2.error).toBeNull();
    expect(rev2.data.reversed).toBe(false);

    // Neto cero: cost + reversal se compensan en posted.
    const { data: entries } = await sb
      .from('costos_entradas')
      .select('sign, amount_base')
      .eq('source_event_id', eid)
      .eq('status', 'posted');
    const neto = (entries || []).reduce((a, e) => a + Number(e.amount_base) * e.sign, 0);
    expect(neto).toBe(0);
  });

  it('sin precio → pending_price con issue (nunca $0 silencioso)', async () => {
    const reg = await sb.rpc('costos_register_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_payload: {
        source_module: 'manual',
        source_entity: 'manual_noprice',
        source_id: '22222222-2222-4222-8222-222222222222',
        event_type: 'labor_usage',
        occurred_at: new Date().toISOString(),
        lote_id: loteId
      }
    });
    const eid = reg.data.event_id;
    const val = await sb.rpc('costos_value_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: eid
    });
    expect(val.error).toBeNull();
    expect(val.data.status).toBe('pending_price');
    const { data: issues } = await sb
      .from('costos_issues')
      .select('issue_type')
      .eq('source_event_id', eid)
      .eq('status', 'open');
    expect((issues || []).map((i) => i.issue_type)).toContain('missing_price');
  });

  it('reverso sin motivo falla con validation', async () => {
    const bad = await sb.rpc('costos_reverse_event', {
      p_company_id: companyId,
      p_user_id: 'test-runner',
      p_event_id: '33333333-3333-4333-8333-333333333333',
      p_reason: 'x'
    });
    expect(bad.error).not.toBeNull();
    expect(bad.error.message).toMatch(/costos\/validation_failed|costos\/event_not_found/);
  });
});
