const getBackendUrl = () => {
  const isDev = import.meta.env.DEV;
  return isDev
    ? 'http://localhost:3000/api'
    : 'https://backend.skycrop.app/api';
};

const _fetch = async (url, options = {}) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const msg = await res.text().catch(() => `Error ${res.status}`);
    throw new Error(`[agronomyRepository] ${res.status} ${res.url}: ${msg}`);
  }
  return res.json();
};

export const agronomyRepository = {

  // ─── CATÁLOGOS ─────────────────────────────────────────────────────────────

  /**
   * Formulario de monitoreo completo para un lote (una sola llamada).
   * Retorna: cultivo, estado fenológico, objetos, protocolos, umbrales, reglas.
   */
  async getFormularioMonitoreo(loteId) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/lotes/${loteId}/formulario-monitoreo`);
    return json.data;
  },

  /**
   * Catálogo maestro de cultivos activos.
   */
  async getCultivos() {
    const json = await _fetch(`${getBackendUrl()}/agronomia/cultivos`);
    return json.data || [];
  },

  /**
   * Estados fenológicos de un cultivo.
   */
  async getEstadosFenologicos(cultivoId) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/cultivos/${cultivoId}/estados-fenologicos`);
    return json.data || [];
  },

  /**
   * Objetos de evaluación (catálogo global o filtrado por cultivo y etapa).
   * @param {string|null} cultivoId
   * @param {string|null} estadoFenologicoId
   */
  async getObjetosEvaluacion(cultivoId = null, estadoFenologicoId = null) {
    const params = new URLSearchParams();
    if (cultivoId) params.set('cultivo_id', cultivoId);
    if (estadoFenologicoId) params.set('estado_fenologico_id', estadoFenologicoId);
    const qs = params.toString() ? `?${params}` : '';
    const json = await _fetch(`${getBackendUrl()}/agronomia/objetos${qs}`);
    return json.data || [];
  },

  /**
   * Tratamientos (ingredientes activos) para un objeto de evaluación.
   */
  async getRecomendaciones(objetoId) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/objetos/${objetoId}/recomendaciones`);
    return json.data;
  },

  // ─── PROTOCOLOS ────────────────────────────────────────────────────────────

  /**
   * Lista de protocolos (biblioteca) con filtros opcionales.
   * @param {{ cultivo_id?, objeto_id?, estado?, created_by? }} filters
   */
  async listProtocolos(filters = {}) {
    const params = new URLSearchParams();
    if (filters.cultivo_id)  params.set('cultivo_id', filters.cultivo_id);
    if (filters.objeto_id)   params.set('objeto_id', filters.objeto_id);
    if (filters.estado)      params.set('estado', filters.estado);
    if (filters.created_by)  params.set('created_by', filters.created_by);
    const qs = params.toString() ? `?${params}` : '';
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos${qs}`);
    return json.data || [];
  },

  /**
   * Detalle completo de un protocolo por ID (cabecera + variables + escalas + umbrales + reglas).
   * Usa el endpoint que llama a la función SQL get_protocolo_completo().
   */
  async getProtocoloById(id) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/${id}`);
    return json.data;
  },

  /**
   * Alias semántico explícito: obtiene el protocolo completamente ensamblado.
   * El backend utiliza ProtocolService.obtener() que llama a get_protocolo_completo().
   */
  async getProtocoloCompleto(id) {
    return this.getProtocoloById(id);
  },

  /**
   * Historial de versiones del mismo objeto de evaluación.
   */
  async getHistorialVersiones(objetoId, cultivoId = null) {
    const params = new URLSearchParams();
    if (cultivoId) params.set('cultivo_id', cultivoId);
    const qs = params.toString() ? `?${params}` : '';
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/${objetoId}/historial${qs}`);
    return json.data || [];
  },

  /**
   * Crear un protocolo nuevo (como borrador o publicado).
   * @param {object} payload
   */
  async saveProtocolo(payload) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return json.data;
  },

  /**
   * Actualizar un protocolo existente.
   */
  async updateProtocolo(id, payload) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return json.data;
  },

  /**
   * Cambiar el estado de un protocolo (borrador → activo → archivado → obsoleto).
   * Atajo sobre updateProtocolo.
   */
  async cambiarEstadoProtocolo(id, nuevoEstado, userId, comentario) {
    return this.updateProtocolo(id, {
      estado:           nuevoEstado,
      updated_by:       userId,
      audit_comentario: comentario
    });
  },

  /**
   * Publicar un protocolo (borrador → activo) usando el endpoint dedicado.
   * El backend aplica la lógica de inmutabilidad y archivado automático.
   * Retorna { data: ProtocoloCompleto, nuevaVersion: boolean, message: string }.
   */
  async publicarProtocolo(id, userId, comentario) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/${id}/publicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, comentario })
    });
    return json;
  },

  /**
   * Clonar un protocolo existente como borrador v1.0.
   */
  async cloneProtocolo(id, userId) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    return json.data;
  },

  /**
   * Importar un protocolo desde JSON externo (siempre como borrador).
   * @param {object} protocolo - JSON del protocolo a importar
   * @param {string} userId
   */
  async importProtocolo(protocolo, userId) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocolo, user_id: userId })
    });
    return json.data;
  },

  /**
   * Eliminar un protocolo por ID.
   */
  async deleteProtocolo(id) {
    const json = await _fetch(`${getBackendUrl()}/agronomia/protocolos/${id}`, {
      method: 'DELETE'
    });
    return json.data;
  }
};
