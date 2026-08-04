/**
 * fertilization.repository.js
 * Capa de acceso a datos del módulo Fertilización.
 *
 * Responsabilidad: Todo el acceso a datos — consultas, filtros, búsqueda,
 * paginación y ordenamiento. Esta capa NO contiene lógica de negocio.
 *
 * Estrategia de swap (mock → Supabase):
 *   Hoy: opera sobre arrays en memoria con simulación async.
 *   Futuro: reemplazar el bloque "mock implementation" por llamadas
 *   a `supabase.from('fertilization_plans')` con los mismos filtros.
 *   Zero cambios requeridos en service, hook o componentes.
 *
 * Filtros soportados server-side (hoy simulados, mañana en Supabase):
 *   - search: busca en name, code, lotName, cropName
 *   - status: estado de trabajo del plan
 *   - validityStatus: estado de vigencia agronómica
 *   - cropId: filtro por cultivo
 *   - farmId: filtro por predio
 *   - lotId: filtro por lote
 *   - dateFrom / dateTo: rango de fecha de creación
 *   - page / pageSize: paginación
 */

import { mockPlansData } from '../data/mockPlans.js';

// Simula latencia de red para que el UX de skeleton/loading se muestre
const SIMULATED_DELAY_MS = 600;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {Object} PlansQueryParams
 * @property {string}  [search]
 * @property {string}  [status]
 * @property {string}  [validityStatus]
 * @property {string}  [cropId]
 * @property {string}  [farmId]
 * @property {string}  [lotId]
 * @property {string}  [dateFrom]
 * @property {string}  [dateTo]
 * @property {number}  [page=1]
 * @property {number}  [pageSize=5]
 * @property {string}  [sortBy='createdAt']
 * @property {'asc'|'desc'} [sortDir='desc']
 */

/**
 * @typedef {Object} PlansQueryResult
 * @property {import('../types/fertilization.types.js').FertilizationPlan[]} data
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalPages
 */

export const fertilizationRepository = {
  /**
   * Consulta planes con filtros, búsqueda y paginación.
   * @param {PlansQueryParams} params
   * @returns {Promise<PlansQueryResult>}
   */
  async getPlans(params = {}) {
    await delay(SIMULATED_DELAY_MS);

    const {
      search = '',
      status = '',
      validityStatus = '',
      cropId = '',
      farmId = '',
      lotId = '',
      dateFrom = '',
      dateTo = '',
      page = 1,
      pageSize = 5,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = params;

    /* ── Mock Implementation ────────────────────────────────────────────────
       Supabase swap: reemplazar este bloque por:
         let query = supabase.from('fertilization_plans').select('*', { count: 'exact' })
         if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,...`)
         if (status) query = query.eq('status', status)
         ... etc
    ─────────────────────────────────────────────────────────────────────── */

    let result = [...mockPlansData];

    // ── Búsqueda full-text (name, code, lotName, cropName, farmName)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.lotName.toLowerCase().includes(q) ||
          p.cropName.toLowerCase().includes(q) ||
          p.farmName.toLowerCase().includes(q),
      );
    }

    // ── Filtros exactos
    if (status)         result = result.filter((p) => p.status === status);
    if (validityStatus) result = result.filter((p) => p.validityStatus === validityStatus);
    if (cropId)         result = result.filter((p) => p.cropId === cropId);
    if (farmId)         result = result.filter((p) => p.farmId === farmId);
    if (lotId)          result = result.filter((p) => p.lotId === lotId);

    // ── Rango de fechas
    if (dateFrom) result = result.filter((p) => p.createdAt >= dateFrom);
    if (dateTo)   result = result.filter((p) => p.createdAt <= dateTo + 'T23:59:59Z');

    // ── Ordenamiento
    result.sort((a, b) => {
      const va = a[sortBy] ?? '';
      const vb = b[sortBy] ?? '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    // ── Paginación
    const total = result.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const data = result.slice(start, start + pageSize);

    return { data, total, page: safePage, pageSize, totalPages };
  },

  /**
   * Obtiene un plan por ID.
   * @param {string} id
   * @returns {Promise<import('../types/fertilization.types.js').FertilizationPlan|null>}
   */
  async getPlanById(id) {
    await delay(300);
    return mockPlansData.find((p) => p.id === id) ?? null;
  },

  /**
   * Crea un nuevo plan. Retorna el plan creado con ID generado.
   * @param {Partial<import('../types/fertilization.types.js').FertilizationPlan>} data
   * @returns {Promise<import('../types/fertilization.types.js').FertilizationPlan>}
   */
  async createPlan(data) {
    await delay(400);
    const now = new Date().toISOString();
    const newPlan = {
      ...data,
      id: `plan-${Date.now()}`,
      version: 'v1.0',
      parentPlanId: null,
      createdAt: now,
      updatedAt: now,
    };
    // Supabase: supabase.from('fertilization_plans').insert(newPlan).select().single()
    mockPlansData.unshift(newPlan);
    return newPlan;
  },

  /**
   * Actualiza un plan existente. En Supabase, no sobrescribirá —
   * el service se encargará de crear una nueva versión.
   * @param {string} id
   * @param {Partial<import('../types/fertilization.types.js').FertilizationPlan>} data
   * @returns {Promise<import('../types/fertilization.types.js').FertilizationPlan>}
   */
  async updatePlan(id, data) {
    await delay(400);
    const idx = mockPlansData.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Plan ${id} no encontrado`);
    mockPlansData[idx] = { ...mockPlansData[idx], ...data, updatedAt: new Date().toISOString() };
    return mockPlansData[idx];
  },

  /**
   * Archiva (soft-delete) un plan.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async archivePlan(id) {
    await delay(300);
    await this.updatePlan(id, { status: 'archived', validityStatus: 'suspended' });
  },

  /**
   * Elimina un plan permanentemente (usar con precaución en prod).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deletePlan(id) {
    await delay(300);
    const idx = mockPlansData.findIndex((p) => p.id === id);
    if (idx !== -1) mockPlansData.splice(idx, 1);
    // Supabase: supabase.from('fertilization_plans').delete().eq('id', id)
  },
};
