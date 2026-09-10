const getBackendUrl = () => {
  const isDev = import.meta.env.DEV;
  return isDev
    ? 'http://localhost:3000/api'
    : 'https://backend.skycrop.app/api';
};

function _auth() { try { const t = sessionStorage.getItem('sb_access_token') || localStorage.getItem('sb_access_token') || ''; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; } }
export const productRepository = {
  async search(query) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/productos?q=${encodeURIComponent(query.trim())}`, { headers: { ..._auth() } });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    return res.json();
  },

  async getDetails(id) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/productos/${id}`, { headers: { ..._auth() } });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    return res.json();
  },

  async logToxicityAudit({ appId, user = 'anonimo', ingredients, geolocalizacion }) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/auditoria/alta-toxicidad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._auth() },
      body: JSON.stringify({
        aplicacion_id: appId,
        usuario_id: user,
        ingredients,
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
