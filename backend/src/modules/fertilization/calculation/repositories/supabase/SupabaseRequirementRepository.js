/**
 * SupabaseRequirementRepository.js
 * Repositorio Supabase para requerimientos nutricionales.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { CropRequirement } from '../../domain/entities/CropRequirement.js';

export class SupabaseRequirementRepository {
  _isUUID(v) {
    return (
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    );
  }
  async _resolveCropId(cropId) {
    if (!cropId) return cropId;
    if (this._isUUID(cropId)) return cropId;
    const normalized = String(cropId).toLowerCase().trim();
    const nameMap = {
      cacao: 'Cacao',
      cafe: 'Café',
      café: 'Café',
      maiz: 'Maíz',
      maíz: 'Maíz',
      soya: 'Soya',
      yuca: 'Yuca',
      platano: 'Plátano',
      plátano: 'Plátano',
      arroz: 'Arroz',
      banano: 'Banano',
      aguacate: 'Aguacate'
    };
    const searchName = nameMap[normalized] || normalized;
    const { data } = await supabaseAdmin
      .from('fert_calc_crops')
      .select('id')
      .ilike('name', searchName)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    return data?.id || cropId;
  }
  async _resolveStageId(stageId, cropId) {
    if (!stageId) return stageId;
    if (this._isUUID(stageId)) return stageId;
    const normalized = String(stageId).toLowerCase().trim();
    const stageMap = {
      vegetativo: 'Vegetativo',
      'desarrollo vegetativo': 'Desarrollo Vegetativo',
      floracion: 'Floración',
      floración: 'Floración',
      llenado: 'Llenado',
      'llenado de mazorca': 'Llenado de Mazorca',
      maduracion: 'Maduración',
      maduración: 'Maduración',
      produccion: 'Producción (Ciclo)',
      producción: 'Producción (Ciclo)',
      establecimiento: 'Establecimiento'
    };
    const searchName = stageMap[normalized] || normalized;
    let q = supabaseAdmin
      .from('fert_calc_phenological_stages')
      .select('id')
      .ilike('name', `%${searchName}%`)
      .eq('status', 'active')
      .limit(1);
    if (cropId && this._isUUID(cropId)) q = q.eq('crop_id', cropId);
    const { data } = await q.maybeSingle();
    return data?.id || stageId;
  }
  /**
   * Obtiene requerimientos para un cultivo/etapa.
   * Prioridad: empresa > global.
   *
   * @param {string} cropId
   * @param {string} stageId
   * @param {string|null} companyId
   * @returns {Promise<CropRequirement[]>}
   */
  async findByCropAndStage(cropId, stageId, companyId = null) {
    const realCropId = await this._resolveCropId(cropId);
    const realStageId = await this._resolveStageId(stageId, realCropId);
    // La columna real es status + is_active (039). Manejar ambas para compatibilidad
    let query = supabaseAdmin.from('fert_calc_requirements').select('*').eq('crop_id', realCropId);

    // stage_id puede ser null (requerimiento total del ciclo) o específico
    if (realStageId) {
      // Incluir tanto la etapa específica como los de ciclo completo (stage_id null) como fallback
      query = query.or(`stage_id.eq.${realStageId},stage_id.is.null`);
    } else {
      // Si no se pide stage, traer todo para ese cultivo (luego filtraremos por prioridad)
      query = query.or(`stage_id.is.null,stage_id.not.is.null`);
    }

    // Filtro de activo: aceptar tanto is_active=true como status=active (compat)
    // No filtramos estrictamente aquí para no perder filas antiguas; filtramos en JS

    if (companyId) {
      query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
    } else {
      query = query.is('company_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filtrar activas y priorizar empresa > global, etapa específica > ciclo completo
    const activeRows = (data ?? []).filter((r) => {
      const isActive = r.is_active !== false && r.status !== 'inactive';
      return isActive;
    });

    // Para cada nutriente, preferir el de empresa sobre el global y etapa específica sobre null
    const byNutrientMethodology = new Map();
    for (const row of activeRows) {
      const key = `${row.nutrient_code}::${row.methodology || 'extraction'}`;
      const existing = byNutrientMethodology.get(key);
      const score = (row.company_id ? 2 : 0) + (row.stage_id ? 1 : 0);
      const existingScore = existing
        ? (existing.company_id ? 2 : 0) + (existing.stage_id ? 1 : 0)
        : -1;
      if (!existing || score > existingScore) {
        byNutrientMethodology.set(key, row);
      }
    }

    return [...byNutrientMethodology.values()].map(this._toRequirement);
  }

  /**
   * Versión paramétrica con filtros de producción (039)
   * @param {Object} params
   */
  async findByParams({ cropId, stageId, companyId, productionSystem, variety, targetYield }) {
    const base = await this.findByCropAndStage(cropId, stageId, companyId);
    // Filtrar en memoria por productionSystem/variety/yield range si vienen en fila
    return base.filter((r) => {
      if (productionSystem && r.productionSystem && r.productionSystem !== productionSystem)
        return false;
      if (variety && r.variety && r.variety !== variety) return false;
      if (targetYield != null) {
        if (r.yieldMin != null && targetYield < r.yieldMin) return false;
        if (r.yieldMax != null && targetYield > r.yieldMax) return false;
      }
      return true;
    });
  }

  _toRequirement(row) {
    // Mapear columnas reales 036/039 a entidad CropRequirement
    return new CropRequirement({
      id: row.id,
      cropId: row.crop_id,
      stageId: row.stage_id,
      nutrientCode: row.nutrient_code,
      amountKgHa: row.amount_kg_ha ?? row.value ?? 0,
      minAmountKgHa: row.min_amount_kg_ha ?? null,
      maxAmountKgHa: row.max_amount_kg_ha ?? null,
      referenceYield: row.reference_yield ?? row.referenceYield ?? null,
      methodology: row.methodology || 'extraction',
      source: row.source ?? row.source_document ?? null,
      status: row.status || (row.is_active === false ? 'inactive' : 'active'),
      // Campos extendidos 039
      productionSystem: row.production_system ?? null,
      variety: row.variety ?? null,
      yieldMin: row.yield_min_t_ha ?? row.yield_min ?? null,
      yieldMax: row.yield_max_t_ha ?? row.yield_max ?? null,
      unit: row.unit || 'kg/ha',
      distributionPct: row.distribution_pct ?? null,
      sourceAuthor: row.source_author ?? null,
      sourceYear: row.source_year ?? null,
      sourceDocument: row.source_document ?? null,
      sourcePage: row.source_page ?? null,
      observations: row.observations ?? null,
      version: row.version || '1.0.0',
      isActive: row.is_active !== false,
      companyId: row.company_id
    });
  }
}
