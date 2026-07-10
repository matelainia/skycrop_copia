import dotenv from 'dotenv';
import app from './api/index.js';

// Cargar variables de entorno desde el archivo .env local
dotenv.config();

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`=================================================`);
  console.log(`🚀 SERVIDOR DE DESARROLLO DEL BACKEND`);
  console.log(`👉 Corriendo en: http://localhost:${port}`);
  console.log(`👉 Proxy de Supabase apuntando a: ${process.env.SUPABASE_URL}`);
  console.log(`=================================================`);
});
