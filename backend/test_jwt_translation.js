const supabaseUrl = 'https://gynttnymneanbziywqqr.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

async function testAllTables() {
  const tables = ['lotes', 'trabajadores', 'maquinaria', 'inventario', 'cultivos', 'protocolos_evaluacion'];

  for (const table of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    console.log(`Table: ${table} | Status: ${res.status} | Data length:`, (await res.json())?.length);
  }
}

testAllTables();
