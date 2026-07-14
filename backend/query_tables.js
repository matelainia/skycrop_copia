import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- USUARIOS Y EMPRESAS ---');
    const { data: usuarios } = await supabase.from('usuarios').select('email, id, empresa_id, empresas(nombre)');
    console.log(JSON.stringify(usuarios, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
