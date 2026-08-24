/**
 * SupabaseNutrientRepository.js
 * Repositorio Supabase para el catálogo de nutrientes.
 * Con fallback al catálogo estático (Nutrient.getDefaultCatalog()) si la tabla no existe.
 */
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { Nutrient } from '../../domain/entities/Nutrient.js';
import { NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseNutrientRepository {
  /**
   * Lista todos los nutrientes del catálogo.
   * Fallback al catálogo estático si no hay datos en BD.
   * @returns {Promise<Nutrient[]>}
   */
  async findAll() {
    try {
      const { data, error } = await supabaseAdmin
        .from('fert_calc_nutrients')
        .select('*')
        .order('category')
        .order('code');

      if (error || !data || data.length === 0) {
        // Fallback al catálogo estático
        return Array.from(Nutrient.getDefaultCatalog().values());
      }

      return data.map(Nutrient.fromRow);
    } catch {
      return Array.from(Nutrient.getDefaultCatalog().values());
    }
  }

  /**
   * Obtiene un nutriente por código.
   * @param {string} code
   * @returns {Promise<Nutrient>}
   */
  async findByCode(code) {
    try {
      const { data, error } = await supabaseAdmin
        .from('fert_calc_nutrients')
        .select('*')
        .eq('code', code)
        .single();

      if (error || !data) {
        // Fallback al catálogo estático
        return Nutrient.findByCode(code);
      }

      return Nutrient.fromRow(data);
    } catch {
      return Nutrient.findByCode(code);
    }
  }

  /**
   * Obtiene múltiples nutrientes por código.
   * @param {string[]} codes
   * @returns {Promise<Map<string, Nutrient>>}
   */
  async findByCodes(codes) {
    const map = new Map();
    for (const code of codes) {
      try {
        const nutrient = await this.findByCode(code);
        map.set(code, nutrient);
      } catch {
        // Ignorar nutrientes no encontrados
      }
    }
    return map;
  }
}
