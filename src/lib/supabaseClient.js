import { createClient } from '@supabase/supabase-js';

// En desarrollo, usamos el backend en localhost (puerto 3000 por defecto)
// En producción, usamos tu dominio personalizado backend.skycrop.app
const isDev = import.meta.env.DEV;
const backendUrl = isDev
  ? 'http://localhost:3000/api'
  : 'https://backend.skycrop.app/api';

// Usamos una clave ficticia en el frontend.
// El proxy de nuestro backend reemplazará esta clave por la real (SUPABASE_ANON_KEY)
// de forma segura en el servidor, evitando exponer tus credenciales reales en el navegador.
const dummyKey = 'dummy-key';

export const supabase = createClient(backendUrl, dummyKey);
