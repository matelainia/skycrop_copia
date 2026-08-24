/**
 * SupabaseRuleRepository.js
 * Repositorio Supabase para reglas agronómicas con jerarquía completa.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { AgronomicRule } from '../../domain/entities/AgronomicRule.js';

export class SupabaseRuleRepository {
  /**
   * Obtiene todas las reglas activas aplicables a un contexto.
   * Incluye globales + región + empresa + predio + lote.
   *
   * @param {string|null} companyId
   * @param {string|null} farmId
   * @param {string|null} lotId
   * @returns {Promise<AgronomicRule[]>}
   */
  async findActive(companyId = null, farmId = null, lotId = null) {
    // Cargar reglas globales siempre
    const conditions = ['scope_level.eq.global'];

    if (companyId) conditions.push(`company_id.eq.${companyId}`);
    if (farmId) conditions.push(`farm_id.eq.${farmId}`);
    if (lotId) conditions.push(`lot_id.eq.${lotId}`);

    const { data, error } = await supabaseAdmin
      .from('fert_calc_rules')
      .select('*')
      .eq('is_active', true)
      .or(conditions.join(','))
      .order('priority', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(this._toRule);
  }

  /**
   * Obtiene una regla específica por ID.
   */
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new Error(`Regla no encontrada: ${id}`);
    return this._toRule(data);
  }

  _toRule(row) {
    return new AgronomicRule({
      id: row.id,
      name: row.name,
      description: row.description,
      cropId: row.crop_id,
      stageId: row.stage_id,
      nutrientCode: row.nutrient_code,
      conditions: row.conditions ?? [],
      actions: row.actions ?? [],
      scope: {
        level: row.scope_level,
        regionCode: row.region_code,
        companyId: row.company_id,
        farmId: row.farm_id,
        lotId: row.lot_id
      },
      priority: row.priority,
      source: row.source,
      version: row.version,
      isActive: row.is_active,
      category: row.category
    });
  }
}
