import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gynttnymneanbziywqqr.supabase.co';
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!jwtSecret || !serviceKey) {
  console.error('❌ Error: SUPABASE_JWT_SECRET y SUPABASE_SERVICE_ROLE_KEY son necesarios en backend/.env');
  process.exit(1);
}

// Cliente administrador para sembrar datos de prueba y verificar logs
const adminClient = createClient(supabaseUrl, serviceKey);

// Función para generar JWT de Supabase simulado
function generateTestJwt(userId, email, companyUuid, roleName) {
  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 10, // 10 minutos
    sub: userId,
    email: email,
    role: 'authenticated',
    app_metadata: { provider: 'clerk', providers: ['clerk'] },
    user_metadata: {},
    org_id: companyUuid,
    role_name: roleName
  };
  return jwt.sign(payload, jwtSecret);
}

// Helper para crear cliente Supabase de usuario autenticado
function getClientForUser(token) {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

async function runTests() {
  console.log('🧪 Iniciando Suite de Pruebas de Aislamiento Multiempresa...');

  let uuidA = null;
  let uuidB = null;

  try {
    // 1. Sembrar Empresas de Prueba (A y B)
    const clerkOrgA = 'org_test_clerk_a';
    const clerkOrgB = 'org_test_clerk_b';

    console.log('1. Sembrando empresas...');
    const { data: compA, error: errA } = await adminClient
      .from('companies')
      .upsert([{ clerk_org_id: clerkOrgA, nombre: 'Empresa Test A' }], { onConflict: 'clerk_org_id' })
      .select()
      .single();
    if (errA) throw new Error(`Fallo sembrando Empresa A: ${errA.message}`);

    const { data: compB, error: errB } = await adminClient
      .from('companies')
      .upsert([{ clerk_org_id: clerkOrgB, nombre: 'Empresa Test B' }], { onConflict: 'clerk_org_id' })
      .select()
      .single();
    if (errB) throw new Error(`Fallo sembrando Empresa B: ${errB.message}`);

    uuidA = compA.id;
    uuidB = compB.id;
    console.log(`✅ Empresa A UUID: ${uuidA}, Empresa B UUID: ${uuidB}`);

    // 2. Sembrar usuarios de prueba en company_users
    console.log('2. Sembrando membresías de usuario...');
    const userIdA = 'user_clerk_test_a';
    const userIdB = 'user_clerk_test_b';

    const { error: muA } = await adminClient
      .from('company_users')
      .upsert([
        { company_id: uuidA, clerk_user_id: userIdA, role_id: 'operario', activo: true },
        { company_id: uuidA, clerk_user_id: 'admin_test_a', role_id: 'administrador', activo: true }
      ], { onConflict: 'company_id,clerk_user_id' });
    if (muA) throw new Error(`Error creando membresía A: ${muA.message}`);

    const { error: muB } = await adminClient
      .from('company_users')
      .upsert([{ company_id: uuidB, clerk_user_id: userIdB, role_id: 'administrador', activo: true }], { onConflict: 'company_id,clerk_user_id' });
    if (muB) throw new Error(`Error creando membresía B: ${muB.message}`);

    // Generar tokens JWT
    const tokenUserA = generateTestJwt(userIdA, 'user_a@test.com', uuidA, 'Operario');
    const tokenAdminA = generateTestJwt('admin_test_a', 'admin_a@test.com', uuidA, 'Administrator');
    const tokenUserB = generateTestJwt(userIdB, 'user_b@test.com', uuidB, 'Administrator');

    // Inicializar clientes
    const clientUserA = getClientForUser(tokenUserA);
    const clientAdminA = getClientForUser(tokenAdminA);
    const clientUserB = getClientForUser(tokenUserB);

    // 3. Prueba 1: SELECT Isolation
    console.log('3. Ejecutando Prueba 1: Aislamiento en SELECT...');
    // Insertar lote en empresa A
    const { data: loteA, error: errLoteA } = await adminClient
      .from('lotes')
      .insert([{ codigo_interno: 'L-TEST-A', nombre: 'Lote Test A', cultivo: 'Maíz', company_id: uuidA }])
      .select()
      .single();
    if (errLoteA) throw new Error(`Error insertando lote A: ${errLoteA.message}`);

    // Insertar lote en empresa B
    const { data: loteB, error: errLoteB } = await adminClient
      .from('lotes')
      .insert([{ codigo_interno: 'L-TEST-B', nombre: 'Lote Test B', cultivo: 'Soya', company_id: uuidB }])
      .select()
      .single();
    if (errLoteB) throw new Error(`Error insertando lote B: ${errLoteB.message}`);

    // Usuario A consulta lotes
    const { data: listA, error: errSelA } = await clientUserA.from('lotes').select('*');
    if (errSelA) throw new Error(`Error en SELECT de Lotes (User A): ${errSelA.message}`);
    
    const containsB = listA.some(l => l.id === loteB.id);
    if (containsB) {
      console.error('❌ FALLÓ: El Usuario A puede ver el lote de la Empresa B.');
    } else {
      console.log('✅ ÉXITO: El Usuario A no ve los lotes de la Empresa B.');
    }

    // 4. Prueba 2: INSERT Forgery
    console.log('4. Ejecutando Prueba 2: Bloqueo de falsificación de company_id en INSERT...');
    // Usuario A intenta insertar un lote forzando company_id de la empresa B
    const { data: forgeLote, error: errForge } = await clientUserA
      .from('lotes')
      .insert([{ codigo_interno: 'L-FORGE', nombre: 'Lote Falso', cultivo: 'Trigo', company_id: uuidB }]);
    
    if (errForge) {
      console.log(`✅ ÉXITO: Inserción falsificada rechazada correctamente. Mensaje: "${errForge.message}"`);
    } else {
      console.error('❌ FALLÓ: Se permitió al Usuario A insertar un registro con el company_id de la Empresa B.');
    }

    // 5. Prueba 3: Cross-Tenant Lote Association en aplicaciones
    console.log('5. Ejecutando Prueba 3: Bloqueo de asociación cruzada de lote...');
    // Usuario A intenta insertar una aplicación agrícola apuntando a su empresa A, pero usando lote_id de la empresa B
    const { data: appCross, error: errCross } = await clientUserA
      .from('aplicaciones')
      .insert([{
        lote_id: loteB.id,
        tipo_aplicacion: 'Fitosanitaria',
        tipo_producto: 'Insecticida',
        producto_comercial: 'Cross Chemical',
        fecha_aplicacion: new Date().toISOString(),
        company_id: uuidA
      }]);

    if (errCross) {
      console.log(`✅ ÉXITO: Asociación cruzada de lote bloqueada. Mensaje: "${errCross.message}"`);
    } else {
      console.error('❌ FALLÓ: Se permitió asociar una aplicación de la Empresa A con un lote de la Empresa B.');
    }

    // 6. Prueba 4: Soft Delete
    console.log('6. Ejecutando Prueba 4: Verificación de eliminación lógica (Soft Delete)...');
    // Eliminar lógicamente lote A (Usuario A actualiza deleted_at)
    const { error: errSoftDel } = await clientUserA
      .from('lotes')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userIdA })
      .eq('id', loteA.id);
    if (errSoftDel) {
      console.error('❌ Error aplicando soft delete detalles:', JSON.stringify(errSoftDel, null, 2));
      throw new Error(`Error aplicando soft delete: ${errSoftDel.message}`);
    }

    // Consultar como Usuario A (Operario) -> no debería aparecer
    const { data: listUserAAfterDel } = await clientUserA.from('lotes').select('*').eq('id', loteA.id);
    const visibleToUser = listUserAAfterDel && listUserAAfterDel.length > 0;

    // Consultar como Administrador A -> debería aparecer
    const { data: listAdminAAfterDel } = await clientAdminA.from('lotes').select('*').eq('id', loteA.id);
    const visibleToAdmin = listAdminAAfterDel && listAdminAAfterDel.length > 0;

    if (!visibleToUser && visibleToAdmin) {
      console.log('✅ ÉXITO: Lote eliminado lógicamente oculto para operarios pero visible para administradores.');
    } else {
      console.error('❌ FALLÓ: Comportamiento de soft delete incorrecto.', { visibleToUser, visibleToAdmin });
    }

    // Restaurar lote A para siguientes pruebas
    await adminClient.from('lotes').update({ deleted_at: null, deleted_by: null }).eq('id', loteA.id);

    // 7. Prueba 5: RPC Validation (iniciar_labor_maquinaria)
    console.log('7. Ejecutando Prueba 5: Validación de inquilino en RPC...');
    // Crear maquinaria en empresa B
    const { data: maqB } = await adminClient
      .from('maquinaria')
      .insert([{
        codigo_id: 'MAQ-TEST-B',
        name: 'Tractor Empresa B',
        type: 'Tractor',
        status: 'Disponible',
        last_maintenance: '2026-01-01',
        next_maintenance: '2026-06-01',
        next_maintenance_hours: 250,
        hours_of_operation: 100,
        hours_today: 0,
        fuel_consumption: '2 Gal/H',
        cost_operator: 10,
        cost_fuel: 10,
        cost_maintenance: 5,
        cost_depreciation: 5,
        company_id: uuidB
      }])
      .select()
      .single();

    // Usuario A intenta iniciar labor en maquinaria de empresa B
    const { data: rpcData, error: rpcErr } = await clientUserA.rpc('iniciar_labor_maquinaria', {
      p_maquinaria_id: maqB.id,
      p_operator: 'Operario Invasor',
      p_lot: 'Lote A',
      p_activity: 'Fumigación',
      p_start_time: new Date().toISOString(),
      p_start_horometro: 100.0,
      p_start_fuel: 50.0
    });

    if (rpcErr) {
      console.log(`✅ ÉXITO: RPC bloqueó el inicio de labor en recurso ajeno. Mensaje: "${rpcErr.message}"`);
    } else {
      console.error('❌ FALLÓ: Se ejecutó RPC iniciar_labor con maquinaria de otra empresa.');
    }

    // 8. Prueba 6: Eventos de seguridad (security_events)
    console.log('8. Ejecutando Prueba 6: Registro de eventos de seguridad...');
    const { data: secEvents, error: secErr } = await adminClient
      .from('security_events')
      .select('*')
      .eq('company_id', uuidA)
      .eq('accion', 'FORGERY_ATTEMPT');

    if (secErr) throw secErr;
    if (secEvents && secEvents.length > 0) {
      console.log(`✅ ÉXITO: Se encontraron ${secEvents.length} eventos de falsificación registrados en security_events.`);
    } else {
      console.error('❌ FALLÓ: No se registró el intento de falsificación en security_events.');
    }

  } catch (err) {
    console.error('❌ Error de Suite de Pruebas:', err.message);
  } finally {
    // Limpieza de datos de prueba
    console.log('Limpiando base de datos...');
    if (uuidA) {
      await adminClient.from('lotes').delete().eq('company_id', uuidA);
      await adminClient.from('company_users').delete().eq('company_id', uuidA);
      await adminClient.from('security_events').delete().eq('company_id', uuidA);
      await adminClient.from('companies').delete().eq('id', uuidA);
    }
    if (uuidB) {
      await adminClient.from('lotes').delete().eq('company_id', uuidB);
      await adminClient.from('maquinaria').delete().eq('company_id', uuidB);
      await adminClient.from('company_users').delete().eq('company_id', uuidB);
      await adminClient.from('companies').delete().eq('id', uuidB);
    }
    console.log('✨ Base de datos limpia.');
  }
}

runTests();
