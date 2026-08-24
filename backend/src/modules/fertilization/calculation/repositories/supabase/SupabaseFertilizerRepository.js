/**
 * SupabaseFertilizerRepository.js
 * Repositorio Supabase para el catálogo de fertilizantes.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { Fertilizer } from '../../domain/entities/Fertilizer.js';
import { NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseFertilizerRepository {
  /**
   * Obtiene fertilizantes activos (globales + de la empresa).
   * @param {string|null} companyId
   * @returns {Promise<Fertilizer[]>}
   */
  async findActive(companyId = null) {
    let query = supabaseAdmin
      .from('fert_calc_fertilizers')
      .select(
        `
        *,
        fert_calc_fertilizer_compositions ( nutrient_code, percent )
      `
      )
      .eq('status', 'active');

    if (companyId) {
      query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
    } else {
      query = query.is('company_id', null);
    }

    const { data, error } = await query.order('commercial_name');
    if (error) throw error;
    return (data ?? []).map(this._toFertilizer);
  }

  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_fertilizers')
      .select(
        `
        *,
        fert_calc_fertilizer_compositions ( nutrient_code, percent )
      `
      )
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError(`Fertilizante no encontrado: ${id}`);
    return this._toFertilizer(data);
  }

  _toFertilizer(row) {
    const composition = {};
    for (const comp of row.fert_calc_fertilizer_compositions ?? []) {
      composition[comp.nutrient_code] = comp.percent;
    }
    return new Fertilizer({
      id: row.id,
      commercialName: row.commercial_name,
      manufacturer: row.manufacturer,
      type: row.type,
      composition,
      density: row.density,
      commercialUnit: row.commercial_unit,
      status: row.status,
      companyId: row.company_id,
      notes: row.notes
    });
  }
}
