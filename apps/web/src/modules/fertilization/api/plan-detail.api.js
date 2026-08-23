/**
 * plan-detail.api.js
 * Capa de acceso a datos para la pantalla de detalle del plan.
 *
 * Llama al backend Express (no a Supabase directamente).
 * Política de datos SkyCrop: sin ramas mock — el detalle proviene
 * siempre del backend/Supabase; sin datos ⇒ error o estado vacío.
 */

// ─── Configuración ─────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Retorna headers de autorización con el token de sesión almacenado.
 * El supabaseToken se almacena via setSupabaseToken() en AuthContext.
 */
function getAuthHeaders() {
  const token = sessionStorage.getItem('sb_access_token') ||
                localStorage.getItem('sb_access_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle completo de un plan de fertilización.
 * @param {string} planId - UUID del plan
 * @returns {Promise<Object>} Detalle normalizado
 */
export async function getFertilizationPlan(planId) {
  const res = await fetch(`${API_BASE}/api/v1/fertilizacion/planes/${planId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status} cargando el plan`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * Actualiza campos editables del plan.
 * @param {string} planId
 * @param {Object} data
 */
export async function updateFertilizationPlan(planId, data) {
  const res = await fetch(`${API_BASE}/api/v1/fertilizacion/planes/${planId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status} actualizando el plan`);
  }
  return (await res.json()).data;
}

/**
 * Registra una nueva observación de campo.
 * @param {string} planId
 * @param {Object} payload - Datos de la observación
 */
export async function saveObservation(planId, payload) {
  const res = await fetch(`${API_BASE}/api/v1/fertilizacion/planes/${planId}/observaciones`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status} guardando la observación`);
  }
  return (await res.json()).data;
}

/**
 * Añade un comentario a una observación.
 * @param {string} observationId
 * @param {string} content
 */
export async function addComment(observationId, content) {
  const res = await fetch(`${API_BASE}/api/v1/fertilizacion/observaciones/${observationId}/comentarios`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status} añadiendo comentario`);
  }
  return (await res.json()).data;
}

/**
 * Marca una aplicación como realizada.
 * @param {string} applicationId
 * @param {Object} completionData
 */
export async function completeApplication(applicationId, completionData) {
  const res = await fetch(`${API_BASE}/api/v1/fertilizacion/aplicaciones/${applicationId}/completar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(completionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status} completando la aplicación`);
  }
  return (await res.json()).data;
}

/**
 * Solicita la exportación del plan a PDF/HTML.
 * Descarga el documento generado por el backend.
 * @param {string} planId
 */
export async function exportPlanPdf(planId) {
  const token = sessionStorage.getItem('sb_access_token') || localStorage.getItem('sb_access_token') || '';
  const url = `${API_BASE}/api/v1/fertilizacion/planes/${planId}/exportar.pdf`;

  // Usar fetch para mantener el token de auth, luego crear blob URL
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Error ${res.status} generando el PDF`);

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `plan-fertilizacion-${planId}.html`;
  a.click();
  URL.revokeObjectURL(blobUrl);
}
