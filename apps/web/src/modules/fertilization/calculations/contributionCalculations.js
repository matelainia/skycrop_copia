/**
 * contributionCalculations.js
 * Orquestador — combina dose + nutrient para la vista de Recomendación.
 * Mantiene la arquitectura desacoplada (§21): presentación separada del motor.
 */

import { deriveDoseMetrics } from './doseCalculations.js';
import {
  calculateNutrientContribution,
  calculateTotalContribution,
  calculateRequirementCoverage,
  calculatePerFertilizerContributions,
} from './nutrientCalculations.js';

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcula el informe completo de aporte nutricional para la recomendación.
 *
 * @param {object} params
 * @param {Array<{ id:string, name:string, presentationKg:number, doseMode:string, doseValue:number, composition:Record<string,number> }>} params.fertilizers
 * @param {number} params.plantsPerHa
 * @param {number} params.areaHa
 * @param {Record<string,number>} params.requirements - kg/ha por nutriente (del análisis/motor)
 * @returns {{
 *   perFertilizer: Array<{ id,string, name:string, doseKgHa:number, doseKgPlant:number|null, doseGPlant:number|null, bagsPerHa:number|null, totalKg:number|null, composition:object, contributions:Record<string,number>, contributionsGPerPlant:Record<string,number> }>,
 *   totals: { doseTotalKgHa:number, doseTotalKgPlant:number|null, totalKg:number|null, totalBags:number|null },
 *   totalContribution: Record<string,number>,
 *   coverage: Record<string,{supplied,required,coverage,deficit,excess,status}>,
 *   hasDeficit: boolean,
 *   hasExcess: boolean
 * }}
 */
export function calculateRecommendationReport({ fertilizers, plantsPerHa, areaHa, requirements }) {
  const pHa = safeNum(plantsPerHa);
  const aHa = safeNum(areaHa);

  const perFertilizer = (fertilizers || []).map((f) => {
    const metrics = deriveDoseMetrics({
      mode: f.doseMode || 'kg_ha',
      value: f.doseValue,
      presentationKg: f.presentationKg,
      plantsPerHa: pHa,
      areaHa: aHa,
    });
    const kgHa = metrics.kgPerHa ?? 0;
    const contributions = calculateNutrientContribution(kgHa, f.composition);
    const contributionsGPerPlant =
      pHa && pHa > 0
        ? Object.fromEntries(
            Object.entries(contributions).map(([k, v]) => [k, (v / pHa) * 1000]),
          )
        : {};

    return {
      id: f.id,
      name: f.name || '—',
      presentationKg: safeNum(f.presentationKg) ?? null,
      doseMode: f.doseMode || 'kg_ha',
      doseValue: safeNum(f.doseValue) ?? 0,
      doseKgHa: kgHa,
      doseKgPlant: metrics.kgPerPlant,
      doseGPlant: metrics.gPerPlant,
      bagsPerHa: metrics.bagsPerHa,
      bagsPerLot: metrics.bagsPerLot,
      totalKg: metrics.kgTotal,
      composition: f.composition || {},
      contributions,
      contributionsGPerPlant,
    };
  });

  const doseTotalKgHa = perFertilizer.reduce((s, f) => s + (f.doseKgHa || 0), 0);
  const doseTotalKgPlant = pHa && pHa > 0 ? doseTotalKgHa / pHa : null;
  const totalKg = aHa ? doseTotalKgHa * aHa : null;
  const totalBags = perFertilizer.reduce((s, f) => {
    // suma de bultos por fertilizante (aprox)
    const b = f.bagsPerHa;
    return s + (b !== null ? b : 0);
  }, 0);
  // Si áreas/bultos no aplican, retornar null
  const totalBagsOut = perFertilizer.some((f) => f.bagsPerHa !== null) ? totalBags : null;

  // Para totalContribution usar doseKgHa + composition
  const totalContribution = calculateTotalContribution(
    perFertilizer.map((f) => ({ doseKgHa: f.doseKgHa, composition: f.composition })),
  );

  const coverage = calculateRequirementCoverage(totalContribution, requirements || {});

  // también exponer per-fertilizer contributions en formato compacto
  const perFertilizerContribs = calculatePerFertilizerContributions(
    perFertilizer.map((f) => ({ id: f.id, name: f.name, doseKgHa: f.doseKgHa, composition: f.composition })),
  );

  const hasDeficit = Object.values(coverage).some((c) => c.status === 'bajo');
  const hasExcess = Object.values(coverage).some((c) => c.status === 'exceso');

  return {
    perFertilizer,
    perFertilizerContribs,
    totals: {
      doseTotalKgHa,
      doseTotalKgPlant,
      doseTotalGPlant: doseTotalKgPlant !== null ? doseTotalKgPlant * 1000 : null,
      totalKg,
      totalBags: totalBagsOut,
    },
    totalContribution,
    coverage,
    hasDeficit,
    hasExcess,
  };
}
