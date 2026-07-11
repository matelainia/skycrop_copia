const getBackendUrl = () => {
  const isDev = import.meta.env.DEV;
  return isDev
    ? 'http://localhost:3000/api'
    : 'https://backend.skycrop.app/api';
};

export const productRepository = {
  async search(query) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/productos?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    return res.json();
  },

  async getDetails(id) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/productos/${id}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    return res.json();
  },

  async logToxicityAudit({ appId, user = 'anonimo', ingredients, geolocalizacion }) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/auditoria/alta-toxicidad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aplicacion_id: appId,
        usuario_id: user,
        ingredientes,
        advertencia_confirmada: true,
        declaracion_profesional: true,
        geolocalizacion
      })
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    return res.json();
  }
};
