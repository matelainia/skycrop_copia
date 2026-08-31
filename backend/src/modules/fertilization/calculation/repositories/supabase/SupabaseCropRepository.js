/**
 * SupabaseCropRepository.js
 * Implementación Supabase del repositorio de cultivos y etapas fenológicas.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { Crop } from '../../domain/entities/Crop.js';
import { PhenologicalStage } from '../../domain/entities/PhenologicalStage.js';
import { NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseCropRepository {
  _isUUID(v) {
    return (
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    );
  }

  async findById(id) {
    // 1) Intento directo por id (UUID real)
    if (this._isUUID(id)) {
      const { data, error } = await supabaseAdmin
        .from('fert_calc_crops')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .single();
      if (!error && data) return this._toCrop(data);
    }
    // 2) Fallback por nombre legible del frontend (cacao, maiz, cafe, etc.) — case-insensitive
    //    y también por id string no-UUID usado en DEFAULT_CROPS
    const normalized = String(id).toLowerCase().trim();
    // Mapeo directo de ids legibles a nombres en DB
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
      aguacate: 'Aguacate',
      palta: 'Aguacate'
    };
    const searchName = nameMap[normalized] || normalized;
    // Buscar por nombre ilike
    const { data: byName, error: errName } = await supabaseAdmin
      .from('fert_calc_crops')
      .select('*')
      .ilike('name', searchName)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!errName && byName) return this._toCrop(byName);

    // 3) Último intento: buscar todos y hacer match flexible
    const { data: all } = await supabaseAdmin
      .from('fert_calc_crops')
      .select('*')
      .eq('status', 'active')
      .limit(50);
    const found = (all || []).find(
      (r) => r.name.toLowerCase() === searchName.toLowerCase() || r.id === id
    );
    if (found) return this._toCrop(found);

    throw new NotFoundError(`Cultivo no encontrado: ${id}`);
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
    if (this._isUUID(id)) {
      const { data, error } = await supabaseAdmin
        .from('fert_calc_phenological_stages')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .single();
      if (!error && data) return this._toStage(data);
    }
    // Fallback por nombre (vegetativo, floracion, etc.)
    const normalized = String(id).toLowerCase().trim();
    const stageNameMap = {
      vegetativo: 'Vegetativo',
      'desarrollo vegetativo': 'Desarrollo Vegetativo',
      floracion: 'Floración',
      floración: 'Floración',
      llenado: 'Llenado',
      'llenado de mazorca': 'Llenado de Mazorca',
      'llenado de fruto': 'Llenado de Mazorca',
      maduracion: 'Maduración',
      maduración: 'Maduración',
      produccion: 'Producción (Ciclo)',
      producción: 'Producción (Ciclo)',
      establecimiento: 'Establecimiento',
      germinacion: 'Germinacion',
      grana: 'Llenado de Grano'
    };
    const searchName = stageNameMap[normalized] || normalized;
    // Buscar por ilike sin crop filter primero
    const { data: byName } = await supabaseAdmin
      .from('fert_calc_phenological_stages')
      .select('*')
      .ilike('name', `%${searchName}%`)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (byName) return this._toStage(byName);

    // Buscar todos y match flexible
    const { data: all } = await supabaseAdmin
      .from('fert_calc_phenological_stages')
      .select('*')
      .eq('status', 'active')
      .limit(100);
    const found = (all || []).find(
      (r) => r.name.toLowerCase().includes(searchName.toLowerCase()) || r.id === id
    );
    if (found) return this._toStage(found);

    throw new NotFoundError(`Etapa fenológica no encontrada: ${id}`);
  }

  async findStagesByCrop(cropId) {
    // Resolver cropId legible a UUID real si es necesario
    let realCropId = cropId;
    if (!this._isUUID(cropId)) {
      try {
        const crop = await this.findById(cropId);
        realCropId = crop.id;
      } catch {
        /* fallback to original */
      }
    }
    const { data, error } = await supabaseAdmin
      .from('fert_calc_phenological_stages')
      .select('*')
      .eq('crop_id', realCropId)
      .eq('status', 'active')
      .order('stage_order');

    if (error) throw error;
    // Fallback: si no hay etapas para ese crop, devolver todas activas (para no bloquear UI)
    const rows = data && data.length ? data : [];
    if (rows.length === 0 && !this._isUUID(cropId)) {
      const { data: all } = await supabaseAdmin
        .from('fert_calc_phenological_stages')
        .select('*')
        .eq('status', 'active')
        .limit(20);
      return (all ?? []).map(this._toStage);
    }
    return rows.map(this._toStage);
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
