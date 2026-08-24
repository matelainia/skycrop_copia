/**
 * SupabaseSoilAnalysisRepository.js
 * Repositorio Supabase para análisis de suelo.
 */

import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { SoilAnalysis } from '../../domain/entities/SoilAnalysis.js';
import { NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseSoilAnalysisRepository {
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_soil_analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError(`Análisis de suelo no encontrado: ${id}`);
    return this._toSoilAnalysis(data);
  }

  async findByLot(lotId, limit = 1) {
    const { data, error } = await supabaseAdmin
      .from('fert_calc_soil_analyses')
      .select('*')
      .eq('lot_id', lotId)
      .order('sample_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(this._toSoilAnalysis);
  }

  async save(soilAnalysis, companyId) {
    const row = this._toRow(soilAnalysis, companyId);
    const { data, error } = await supabaseAdmin
      .from('fert_calc_soil_analyses')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return this._toSoilAnalysis(data);
  }

  _toSoilAnalysis(row) {
    return new SoilAnalysis({
      id: row.id,
      companyId: row.company_id,
      lotId: row.lot_id,
      sampleDate: row.sample_date,
      labReportCode: row.lab_report_code,
      pH: row.ph,
      organicMatter: row.organic_matter,
      cec: row.cec,
      texture: row.texture,
      N: row.n_value !== null ? { value: row.n_value, unit: row.n_unit ?? 'mg/kg' } : null,
      P: row.p_value !== null ? { value: row.p_value, unit: row.p_unit ?? 'mg/kg' } : null,
      pExtractant: row.p_extractant,
      K: row.k_value !== null ? { value: row.k_value, unit: row.k_unit ?? 'cmol(+)/kg' } : null,
      Ca: row.ca_value !== null ? { value: row.ca_value, unit: row.ca_unit ?? 'cmol(+)/kg' } : null,
      Mg: row.mg_value !== null ? { value: row.mg_value, unit: row.mg_unit ?? 'cmol(+)/kg' } : null,
      S: row.s_value !== null ? { value: row.s_value, unit: row.s_unit ?? 'mg/kg' } : null,
      Fe: row.fe_value !== null ? { value: row.fe_value, unit: 'mg/kg' } : null,
      Mn: row.mn_value !== null ? { value: row.mn_value, unit: 'mg/kg' } : null,
      Zn: row.zn_value !== null ? { value: row.zn_value, unit: 'mg/kg' } : null,
      Cu: row.cu_value !== null ? { value: row.cu_value, unit: 'mg/kg' } : null,
      B: row.b_value !== null ? { value: row.b_value, unit: 'mg/kg' } : null,
      caSaturation: row.ca_saturation,
      mgSaturation: row.mg_saturation,
      kSaturation: row.k_saturation,
      alSaturation: row.al_saturation,
      bulkDensity: row.bulk_density,
      samplingDepthCm: row.sampling_depth_cm
    });
  }

  _toRow(soilAnalysis, companyId) {
    return {
      id: soilAnalysis.id,
      company_id: companyId,
      lot_id: soilAnalysis.lotId,
      sample_date: soilAnalysis.sampleDate?.toISOString().slice(0, 10),
      lab_report_code: soilAnalysis.labReportCode,
      ph: soilAnalysis.pH,
      organic_matter: soilAnalysis.organicMatter,
      cec: soilAnalysis.cec,
      texture: soilAnalysis.texture,
      n_value: soilAnalysis.N?.value,
      n_unit: soilAnalysis.N?.unit,
      p_value: soilAnalysis.P?.value,
      p_unit: soilAnalysis.P?.unit,
      p_extractant: soilAnalysis.pExtractant,
      k_value: soilAnalysis.K?.value,
      k_unit: soilAnalysis.K?.unit,
      ca_value: soilAnalysis.Ca?.value,
      ca_unit: soilAnalysis.Ca?.unit,
      mg_value: soilAnalysis.Mg?.value,
      mg_unit: soilAnalysis.Mg?.unit,
      s_value: soilAnalysis.S?.value,
      s_unit: soilAnalysis.S?.unit,
      fe_value: soilAnalysis.Fe?.value,
      mn_value: soilAnalysis.Mn?.value,
      zn_value: soilAnalysis.Zn?.value,
      cu_value: soilAnalysis.Cu?.value,
      b_value: soilAnalysis.B?.value,
      ca_saturation: soilAnalysis.caSaturation,
      mg_saturation: soilAnalysis.mgSaturation,
      k_saturation: soilAnalysis.kSaturation,
      al_saturation: soilAnalysis.alSaturation,
      bulk_density: soilAnalysis.bulkDensity,
      sampling_depth_cm: soilAnalysis.samplingDepthCm
    };
  }
}
