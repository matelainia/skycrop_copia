/**
 * SupabaseRequirementRepository.js
 * Repositorio Supabase para requerimientos nutricionales.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { CropRequirement } from '../../domain/entities/CropRequirement.js';

export class SupabaseRequirementRepository {
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
    let query = supabaseAdmin
      .from('fert_calc_requirements')
      .select('*')
      .eq('crop_id', cropId)
      .eq('stage_id', stageId)
      .eq('is_active', true);

    if (companyId) {
      query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
    } else {
      query = query.is('company_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Para cada nutriente, preferir el de empresa sobre el global
    const byNutrientMethodology = new Map();
    for (const row of data ?? []) {
      const key = `${row.nutrient_code}::${row.methodology}`;
      const existing = byNutrientMethodology.get(key);
      // Empresa tiene prioridad sobre global
      if (!existing || (row.company_id && !existing.company_id)) {
        byNutrientMethodology.set(key, row);
      }
    }

    return [...byNutrientMethodology.values()].map(this._toRequirement);
  }

  _toRequirement(row) {
    return new CropRequirement({
      id: row.id,
      cropId: row.crop_id,
      stageId: row.stage_id,
      nutrientCode: row.nutrient_code,
      methodology: row.methodology,
      value: row.value,
      unit: row.unit,
      yieldReference: row.yield_reference,
      yieldMin: row.yield_min,
      yieldMax: row.yield_max,
      source: row.source,
      version: row.version,
      isActive: row.is_active,
      companyId: row.company_id
    });
  }
}
