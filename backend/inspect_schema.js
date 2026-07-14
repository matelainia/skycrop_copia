import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('Fetching database schema via information_schema...');
    
    const { data: cols, error: colErr } = await supabase
      .from('usuarios') // Just a random query to verify connection, or we can use RPC
      .select('*')
      .limit(1);
      
    // Since Supabase JS client doesn't expose a raw sql method by default without RPC,
    // let's create a custom RPC call or run a query on information_schema if enabled,
    // or let's use a standard POSTGRES RPC if it exists.
    // If not, we can query information_schema columns by creating an RPC function, 
    // or we can query it directly using pg client.
    // Wait, let's see if we have direct pg access. Let's check package.json in backend.
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
