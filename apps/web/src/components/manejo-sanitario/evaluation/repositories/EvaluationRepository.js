const getBackendUrl = () => {
  const isDev = import.meta.env.DEV;
  return isDev
    ? 'http://localhost:3000/api'
    : 'https://backend.skycrop.app/api';
};

export const EvaluationRepository = {
  /**
   * Guarda o actualiza un borrador en el servidor.
   */
  async saveDraft(draftPayload) {
    const url = `${getBackendUrl()}/evaluaciones/draft`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftPayload)
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al guardar el borrador de evaluación.`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Obtiene el borrador activo para el lote, usuario y empresa.
   */
  async getDraft(loteId, userId, companyId) {
    const url = `${getBackendUrl()}/evaluaciones/draft/${loteId}?userId=${encodeURIComponent(userId)}&companyId=${encodeURIComponent(companyId)}`;
    const res = await fetch(url);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener el borrador de la evaluación.`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Geocodifica un lote de forma automática usando PostGIS / Nominatim.
   */
  async geocodeLote(loteId) {
    const url = `${getBackendUrl()}/evaluaciones/geocode`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loteId })
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al geocodificar el lote ${loteId}`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Crea una nueva evaluación final de forma transaccional.
   */
  async createEvaluation(payload) {
    const url = `${getBackendUrl()}/evaluaciones`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Error ${res.status} al registrar la evaluación.`);
    }
    const json = await res.json();
    return json.data;
  }
};
