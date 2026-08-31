import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
dotenv.config();
const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service);
const clerkOrg = 'org_3GSw1Rei28cqDgcfHvDocbBosNN';
const clerkUser = 'user_3GNSdHfng4hvOciUOQTCqmA6NQx';
console.log('Buscando company por clerk_org_id', clerkOrg);
let {data: comp, error} = await admin.from('companies').select('*').eq('clerk_org_id', clerkOrg).maybeSingle();
console.log('comp error', error, 'comp', comp);
if (comp) {
  console.log('company_id', comp.id);
  let {data: cu, error: cuErr} = await admin.from('company_users').select('*').eq('company_id', comp.id).eq('clerk_user_id', clerkUser).maybeSingle();
  console.log('company_users err', cuErr, 'cu', cu);
  let {data: prof, error: pErr} = await admin.from('profiles').select('*').eq('id', clerkUser).maybeSingle();
  console.log('profile err', pErr, 'profile', prof);
  const secret = process.env.SUPABASE_JWT_SECRET;
  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now()/1000)+3600,
    sub: clerkUser,
    email: prof?.email || 'test@example.com',
    role: 'authenticated',
    app_metadata: { provider: 'clerk', providers: ['clerk'] },
    user_metadata: {},
    org_id: comp.id,
    role_name: cu?.role_id || 'administrador'
  };
  const token = jwt.sign(payload, secret);
  console.log('token prefix', token.substring(0,50));
  const client = createClient('http://localhost:3000/api', token);
  const codigo = 'TEST-REAL-'+Math.floor(Math.random()*9999);
  console.log('intentando insert lote como usuario real, codigo', codigo);
  let {data: ins, error: insErr} = await client.from('lotes').insert({ codigo_interno: codigo, nombre: 'Lote Real Test', cultivo: 'Maiz', area_ha: 1.0 }).select();
  console.log('insert err', JSON.stringify(insErr));
  console.log('insert data', JSON.stringify(ins));
  if (!insErr && ins) {
    console.log('SUCCESS real user insert');
    await client.from('lotes').delete().eq('id', ins[0].id);
    console.log('cleanup done');
  }
} else {
  console.log('company not found, listing all');
  let {data: all} = await admin.from('companies').select('id, clerk_org_id, nombre').limit(10);
  console.log(all);
}
