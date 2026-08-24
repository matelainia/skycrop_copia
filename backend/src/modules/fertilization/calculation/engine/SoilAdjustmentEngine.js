/**
 * SoilAdjustmentEngine.js
 * Diagnóstico del suelo: validación, normalización, clasificación y factores de ajuste.
 *
 * RESPONSABILIDAD:
 *   1. Recibe el análisis de suelo (SoilAnalysis)
 *   2. Normaliza las unidades de cada nutriente
 *   3. Convierte a kg/ha disponibles
 *   4. Clasifica cada nutriente (muy bajo/bajo/medio/alto/muy alto)
 *   5. Aplica las reglas del suelo para determinar factores de corrección
 *   6. Retorna el contexto enriquecido de suelo para el resto del pipeline
 *
 * SALIDA:
 *   {
 *     soilContext: { pH, organicMatter, cec, K: { value, unit, classification, availableKgHa }, ... },
 *     soilContributions: { N: kg/ha, P2O5: kg/ha, K2O: kg/ha, ... },
 *     warnings: []
 *   }
 */

import {
  mgKgToKgHa,
  cmolKgKToKgHa,
  classifyK,
  classifyP,
  classifyCa,
  classifyMg,
  classifyS,
  classifyPH,
  classifyOrganicMatter,
  calculateSoilContribution,
  estimateNFromMO
} from '../formulas/soil.formulas.js';
import {
  DEFAULT_SOIL_AVAILABILITY,
  NUTRIENT_CONVERSION_FACTORS
} from '../domain/types/fertilization-calc.types.js';

export class SoilAdjustmentEngine {
  /**
   * @param {Object} params
   * @param {import('../domain/entities/SoilAnalysis.js').SoilAnalysis} params.soilAnalysis
   * @param {Object.<string, number>} [params.availabilityOverrides] - Sobreescribir disponibilidad por nutriente
   * @param {string[]} [params.requiredNutrients] - Nutrientes que necesita el cultivo
   * @returns {{ soilContext: Object, soilContributions: Object.<string, number>, warnings: string[] }}
   */
  analyze({ soilAnalysis, availabilityOverrides = {}, requiredNutrients = [] }) {
    const warnings = [];
    const soilContext = {
      pH: soilAnalysis.pH,
      phClassification: soilAnalysis.pH !== null ? classifyPH(soilAnalysis.pH) : null,
      organicMatter: soilAnalysis.organicMatter,
      omClassification:
        soilAnalysis.organicMatter !== null
          ? classifyOrganicMatter(soilAnalysis.organicMatter)
          : null,
      cec: soilAnalysis.cec,
      texture: soilAnalysis.texture,
      bulkDensity: soilAnalysis.bulkDensity ?? 1.3,
      samplingDepthCm: soilAnalysis.samplingDepthCm ?? 20
    };
    const soilContributions = {};

    // ── pH warnings ──────────────────────────────────────────────────────────
    if (soilAnalysis.pH !== null) {
      if (soilAnalysis.pH < 5.0) {
        warnings.push(
          `pH muy ácido (${soilAnalysis.pH}) — considerar encalamiento. Disponibilidad de P, Ca, Mg reducida.`
        );
      } else if (soilAnalysis.pH > 8.0) {
        warnings.push(
          `pH alcalino (${soilAnalysis.pH}) — disponibilidad de micronutrientes (Fe, Mn, Zn, Cu) reducida.`
        );
      }
    }

    // ── N desde MO ────────────────────────────────────────────────────────────
    if (soilAnalysis.organicMatter !== null) {
      const nFromMO = estimateNFromMO(soilAnalysis.organicMatter);
      const availability = availabilityOverrides['N'] ?? DEFAULT_SOIL_AVAILABILITY['N'] ?? 0.5;
      soilContext.N = {
        estimatedFromMO: true,
        kgHaTotal: nFromMO,
        availableKgHa: calculateSoilContribution(nFromMO, availability),
        classification: classifyOrganicMatter(soilAnalysis.organicMatter)
      };
      soilContributions['N'] = parseFloat(soilContext.N.availableKgHa.toFixed(4));
    } else if (requiredNutrients.includes('N')) {
      warnings.push(
        'Sin datos de MO en el suelo — aporte de N del suelo no calculado (se asume 0)'
      );
    }

    // ── P disponible (mg/kg → kg/ha P₂O₅) ────────────────────────────────────
    if (soilAnalysis.P?.value !== null && soilAnalysis.P !== null) {
      const pMgKg = soilAnalysis.P.value;
      const da = soilContext.bulkDensity;
      const depth = soilContext.samplingDepthCm;
      const pKgHa = mgKgToKgHa(pMgKg, da, depth); // kg P/ha (elemental)
      const p2o5KgHa = pKgHa * NUTRIENT_CONVERSION_FACTORS.P_TO_P2O5; // kg P₂O₅/ha
      const classification = classifyP(pMgKg);
      const availability =
        availabilityOverrides['P2O5'] ?? DEFAULT_SOIL_AVAILABILITY['P2O5'] ?? 0.2;
      soilContext.P2O5 = {
        rawMgKg: pMgKg,
        kgHaElemental: pKgHa,
        kgHaOxide: p2o5KgHa,
        classification,
        availableKgHa: calculateSoilContribution(p2o5KgHa, availability),
        extractant: soilAnalysis.pExtractant ?? 'unknown'
      };
      soilContributions['P2O5'] = parseFloat(soilContext.P2O5.availableKgHa.toFixed(4));

      if (classification === 'very_low' || classification === 'low') {
        warnings.push(
          `P disponible ${classification === 'very_low' ? 'muy bajo' : 'bajo'} (${pMgKg} mg/kg)`
        );
      }
    }

    // ── K intercambiable (cmol/kg → kg/ha K₂O) ───────────────────────────────
    if (soilAnalysis.K?.value !== null && soilAnalysis.K !== null) {
      const kCmolKg = soilAnalysis.K.value;
      const da = soilContext.bulkDensity;
      const depth = soilContext.samplingDepthCm;
      const { k2oKgHa } = cmolKgKToKgHa(kCmolKg, da, depth);
      const classification = classifyK(kCmolKg);
      const availability = availabilityOverrides['K2O'] ?? DEFAULT_SOIL_AVAILABILITY['K2O'] ?? 0.8;
      soilContext.K2O = {
        rawCmolKg: kCmolKg,
        kgHaOxide: k2oKgHa,
        classification,
        availableKgHa: calculateSoilContribution(k2oKgHa, availability)
      };
      soilContributions['K2O'] = parseFloat(soilContext.K2O.availableKgHa.toFixed(4));

      if (classification === 'very_low' || classification === 'low') {
        warnings.push(
          `K intercambiable ${classification === 'very_low' ? 'muy bajo' : 'bajo'} (${kCmolKg} cmol(+)/kg)`
        );
      }
    }

    // ── Ca intercambiable ─────────────────────────────────────────────────────
    if (soilAnalysis.Ca?.value !== null && soilAnalysis.Ca !== null) {
      const caCmolKg = soilAnalysis.Ca.value;
      // Ca (mg/kg equiv): Ca peso molar=40.08, divalente → 1 cmol(+)/kg = 40.08/2 × 10 = 200.4 mg/kg
      const caMgKg = caCmolKg * 200.4;
      const caKgHa = mgKgToKgHa(caMgKg, soilContext.bulkDensity, soilContext.samplingDepthCm);
      const classification = classifyCa(caCmolKg);
      const availability = availabilityOverrides['Ca'] ?? DEFAULT_SOIL_AVAILABILITY['Ca'] ?? 0.9;
      soilContext.Ca = {
        rawCmolKg: caCmolKg,
        kgHa: caKgHa,
        classification,
        availableKgHa: calculateSoilContribution(caKgHa, availability)
      };
      soilContributions['Ca'] = parseFloat(soilContext.Ca.availableKgHa.toFixed(4));
    }

    // ── Mg intercambiable ─────────────────────────────────────────────────────
    if (soilAnalysis.Mg?.value !== null && soilAnalysis.Mg !== null) {
      const mgCmolKg = soilAnalysis.Mg.value;
      // Mg: 24.31, divalente → 1 cmol/kg = 121.55 mg/kg
      const mgMgKg = mgCmolKg * 121.55;
      const mgKgHa = mgKgToKgHa(mgMgKg, soilContext.bulkDensity, soilContext.samplingDepthCm);
      const classification = classifyMg(mgCmolKg);
      const availability = availabilityOverrides['Mg'] ?? DEFAULT_SOIL_AVAILABILITY['Mg'] ?? 0.85;
      soilContext.Mg = {
        rawCmolKg: mgCmolKg,
        kgHa: mgKgHa,
        classification,
        availableKgHa: calculateSoilContribution(mgKgHa, availability)
      };
      soilContributions['Mg'] = parseFloat(soilContext.Mg.availableKgHa.toFixed(4));
    }

    // ── S disponible (mg/kg → kg/ha) ─────────────────────────────────────────
    if (soilAnalysis.S?.value !== null && soilAnalysis.S !== null) {
      const sMgKg = soilAnalysis.S.value;
      const sKgHa = mgKgToKgHa(sMgKg, soilContext.bulkDensity, soilContext.samplingDepthCm);
      const classification = classifyS(sMgKg);
      const availability = availabilityOverrides['S'] ?? DEFAULT_SOIL_AVAILABILITY['S'] ?? 0.6;
      soilContext.S = {
        rawMgKg: sMgKg,
        kgHa: sKgHa,
        classification,
        availableKgHa: calculateSoilContribution(sKgHa, availability)
      };
      soilContributions['S'] = parseFloat(soilContext.S.availableKgHa.toFixed(4));
    }

    return { soilContext, soilContributions, warnings };
  }
}
