const getBackendUrl = () => {
  const isDev = import.meta.env.DEV;
  return isDev
    ? 'http://localhost:3000/api'
    : 'https://backend.skycrop.app/api';
};

function _auth() {
  try { const t = sessionStorage.getItem('sb_access_token') || localStorage.getItem('sb_access_token') || ''; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}
export const geeRepository = {
  async getGeeIndex(coordinates, indexType, loteId) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/gee/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._auth() },
      body: JSON.stringify({
        coordinates,
        indexType,
        loteId
      })
    });
    
    if (!res.ok) {
      throw new Error(`GEE API error: ${res.statusText}`);
    }
    return res.json();
  },

  async auditApplicationState(appId) {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/auditoria/estado-aplicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._auth() },
      body: JSON.stringify({ aplicacion_id: appId })
    });
    
    if (!res.ok) {
      throw new Error(`Audit API error: ${res.statusText}`);
    }
    return res.json();
  }
};
