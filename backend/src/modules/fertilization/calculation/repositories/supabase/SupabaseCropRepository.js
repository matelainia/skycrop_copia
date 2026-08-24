/**
 * SupabaseCropRepository.js
 * Implementación Supabase del repositorio de cultivos y etapas fenológicas.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { Crop } from '../../domain/entities/Crop.js';
import { PhenologicalStage } from '../../domain/entities/PhenologicalStage.js';
import { NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseCropRepository {
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_crops')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error || !data) throw new NotFoundError(`Cultivo no encontrado: ${id}`);
    return this._toCrop(data);
  }

  async findAll() {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_crops')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;
    return (data ?? []).map(this._toCrop);
  }

  async findStageById(id) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_phenological_stages')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error || !data) throw new NotFoundError(`Etapa fenológica no encontrada: ${id}`);
    return this._toStage(data);
  }

  async findStagesByCrop(cropId) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_phenological_stages')
      .select('*')
      .eq('crop_id', cropId)
      .eq('status', 'active')
      .order('order');

    if (error) throw error;
    return (data ?? []).map(this._toStage);
  }

  _toCrop(row) {
    return new Crop({
      id: row.id,
      name: row.name,
      scientificName: row.scientific_name,
      status: row.status,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  _toStage(row) {
    return new PhenologicalStage({
      id: row.id,
      cropId: row.crop_id,
      name: row.name,
      order: row.order,
      status: row.status,
      durationDays: row.duration_days,
      description: row.description
    });
  }
}
