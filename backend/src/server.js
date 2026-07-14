import env from './shared/config/env.js';
import app from './app.js';

const port = env.PORT;

app.listen(port, () => {
  console.log(`=================================================`);
  console.log(`🚀 SERVIDOR MODULAR INICIADO (Fase de Transición)`);
  console.log(`👉 Corriendo en: http://localhost:${port}`);
  console.log(`👉 Ambiente: ${env.NODE_ENV}`);
  console.log(`👉 Proxy de Supabase apuntando a: ${env.SUPABASE_URL}`);
  console.log(`=================================================`);
});
export default app;
