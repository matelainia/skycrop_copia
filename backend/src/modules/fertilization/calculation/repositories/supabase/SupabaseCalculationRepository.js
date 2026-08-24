/**
 * SupabaseCalculationRepository.js
 * Repositorio Supabase para guardar y consultar cálculos de fertilización.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';

export class SupabaseCalculationRepository {
  /**
   * Guarda un cálculo de fertilización con su snapshot inmutable.
   */
  async save({
    userId,
    companyId,
    cropId,
    stageId,
    lotId,
    targetYieldTHa,
    methodology,
    soilAnalysisId,
    calculationVersion,
    result,
    snapshot,
    rulesSnapshot
  }) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_calculations')
      .insert({
        user_id: userId,
        company_id: companyId,
        crop_id: cropId,
        stage_id: stageId,
        lot_id: lotId,
        target_yield_t_ha: targetYieldTHa,
        methodology,
        soil_analysis_id: soilAnalysisId,
        calculation_version: calculationVersion,
        status: result.status,
        result_json: result,
        has_deficits: result.balance_totals?.deficits?.length > 0,
        has_surpluses: result.balance_totals?.surpluses?.length > 0,
        warnings_count: result.warnings?.length ?? 0
      })
      .select('id')
      .single();

    if (error) throw error;

    // Guardar snapshot en tabla separada para trazabilidad inmutable
    await supabaseAdmin.from('fert_calc_calculation_snapshots').insert({
      calculation_id: data.id,
      snapshot_json: snapshot,
      rules_snapshot_json: rulesSnapshot,
      engine_version: '1.0.0',
      calculation_version: calculationVersion
    });

    return data.id;
  }

  /**
   * Obtiene el historial de cálculos de una empresa.
   */
  async findByCompany(companyId, { limit = 20, offset = 0 } = {}) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_calculations')
      .select(
        `
        id, calculation_version, status, methodology, target_yield_t_ha,
        has_deficits, has_surpluses, warnings_count, created_at,
        crop_id, stage_id, lot_id
      `
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Obtiene el detalle de un cálculo con su snapshot.
   */
  async findById(calculationId) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_calculations')
      .select(
        `
        *,
        fert_calc_calculation_snapshots ( snapshot_json, rules_snapshot_json, engine_version )
      `
      )
      .eq('id', calculationId)
      .single();

    if (error || !data) throw new Error(`Cálculo no encontrado: ${calculationId}`);
    return data;
  }
}
