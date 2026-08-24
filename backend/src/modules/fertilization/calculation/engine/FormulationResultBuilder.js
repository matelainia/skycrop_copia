/**
 * FormulationResultBuilder.js
 * Construye el resultado final de la formulación (§28 del diseño) a partir
 * de la salida del solver, aplicando el post-procesado comercial:
 *
 *   17. dosis óptimas kg/ha          → del FormulationEngine
 *   18. ajustar a presentación       → bultos = ceil(kg_lote / presentación)
 *   19-21. recalcular kg reales      → la dosis real se deriva de los bultos
 *   22. dosis por planta             → g/planta con plantasHa
 *   23. aporte real por nutriente    → recalculado con la dosis real
 *   24. cobertura %                  → configurable (95% / 100% / 110%)
 *   25-26. déficit / exceso          → estado por nutriente
 *   27. costo                        → null si no hay precio (nunca inventado)
 *   29. snapshot inmutable           → trazabilidad histórica
 */

import {
  adjustToPackages,
  dosePerPlant,
  sumContributions,
  coverageStatus
} from '../formulas/formulation.formulas.js';
import { FORMULATION_CONFIG_VERSION } from '../config/formulation.config.js';

export class FormulationResultBuilder {
  /**
   * @param {Object} params
   * @param {Object} params.solveResult - salida de FormulationEngine.solve()
   * @param {import('../domain/entities/FertilizerSource.js').FertilizerSource[]} params.sources
   * @param {Record<string, number>} params.requirements - requerimiento neto kg/ha (diagnóstico)
   * @param {number|null} [params.areaHa]
   * @param {number|null} [params.plantsHa]
   * @param {Object} params.context - { crop, stage, targetYieldTHa, methodology, soilAnalysis }
   * @param {string} params.calculationVersion
   */
  build({
    solveResult,
    sources,
    requirements,
    areaHa = null,
    plantsHa = null,
    context,
    calculationVersion
  }) {
    const config = solveResult.config;

    if (solveResult.status === 'no_solution') {
      return this._buildNoSolution({
        solveResult,
        sources,
        requirements,
        areaHa,
        plantsHa,
        context,
        calculationVersion,
        config
      });
    }

    const sourceById = new Map(sources.map((s) => [s.id, s]));

    // ── Post-procesado comercial por producto ────────────────────────────
    const products = solveResult.doses.map((dose) => {
      const source = sourceById.get(dose.sourceId);
      const pkg = adjustToPackages(dose.calculatedDoseKgHa, areaHa ?? 1, source.presentationKg);
      const plant = dosePerPlant(pkg.actualDoseKgHa, plantsHa);

      // Aporte real calculado con la dosis REAL post-bultos (§14)
      const contributions = source.contributionsFor(pkg.actualDoseKgHa);
      const totalKgBilled = pkg.totalPackagesKg ?? pkg.actualDoseKgHa * (areaHa ?? 1);

      return {
        product_id: source.id,
        master_fertilizer_id: source.masterFertilizerId,
        name: source.name,
        composition: { ...source.composition },

        calculated_dose_kg_ha: dose.calculatedDoseKgHa,
        actual_dose_kg_ha: pkg.actualDoseKgHa,

        presentation_kg: source.presentationKg,
        packages_per_ha: pkg.packagesPerHa,
        total_packages: pkg.packages,
        total_packages_kg: pkg.totalPackagesKg,
        total_kg: parseFloat((pkg.actualDoseKgHa * (areaHa ?? 1)).toFixed(4)),

        dose_kg_plant: plant.kgPerPlant,
        dose_g_plant: plant.gPerPlant,

        contributions,

        // Costo solo si existe precio declarado (§27.3)
        unit_price: source.hasPrice() ? source.pricePerUnit : null,
        cost: source.hasPrice()
          ? parseFloat((totalKgBilled * source.pricePerUnit).toFixed(2))
          : null
      };
    });

    // ── Aporte total real y balance nutricional ──────────────────────────
    const suppliedTotal = sumContributions(
      products.map((p) => ({
        source: sourceById.get(p.product_id),
        doseKgHa: p.actual_dose_kg_ha
      }))
    );

    const nutrient_balance = {};
    for (const [nutrient, required] of Object.entries(requirements)) {
      const suppliedRaw = suppliedTotal[nutrient] ?? 0;
      const { coveragePct, status } = coverageStatus(suppliedRaw, required, config.coverageRanges);
      nutrient_balance[nutrient] = {
        required: parseFloat(Number(required).toFixed(4)),
        supplied: parseFloat(suppliedRaw.toFixed(4)),
        coverage: coveragePct,
        status
      };
    }

    const pricedProducts = products.filter((p) => p.cost !== null);
    const total_cost =
      pricedProducts.length > 0
        ? parseFloat(pricedProducts.reduce((s, p) => s + p.cost, 0).toFixed(2))
        : null;

    const hasDeficit = Object.values(nutrient_balance).some((b) => b.status === 'deficit');
    const hasExcess = Object.values(nutrient_balance).some((b) => b.status === 'excess');
    const status = hasDeficit ? 'partial' : 'feasible';

    const warnings = [...solveResult.warnings];
    if (hasExcess) {
      warnings.push(
        `Sobreaplicación en: ${Object.entries(nutrient_balance)
          .filter(([, b]) => b.status === 'excess')
          .map(([n]) => n)
          .join(', ')}. El rango permitido proviene de la configuración agronómica.`
      );
    }

    const timestamp = new Date().toISOString();
    const result = {
      status,
      formulation_status: solveResult.status,

      crop: context.crop?.toObject ? context.crop.toObject() : (context.crop ?? null),
      phenological_stage: context.stage?.toObject
        ? context.stage.toObject()
        : (context.stage ?? null),
      target_yield_t_ha: context.targetYieldTHa ?? null,
      methodology: context.methodology ?? 'auto',
      soil_analysis: context.soilAnalysis?.toObject
        ? context.soilAnalysis.toObject()
        : (context.soilAnalysis ?? null),

      lot_context: {
        area_ha: areaHa,
        plants_per_ha: plantsHa
      },

      requirements,
      products,
      nutrient_balance,
      total_cost,
      currency: pricedProducts.length > 0 ? 'USD' : null,

      unit_display_options: [
        'kg_ha',
        'kg_planta',
        'g_planta',
        'bultos_ha',
        'bultos_totales',
        'kg_totales'
      ],
      canonical_unit: 'kg/ha',

      warnings: [...new Set(warnings)],
      calculation_version: calculationVersion,
      engine_version: '2.0.0',
      formulation_config_version: FORMULATION_CONFIG_VERSION,
      calculated_at: timestamp,

      snapshot: this._buildSnapshot({
        solveResult,
        sources,
        requirements,
        products,
        nutrient_balance,
        areaHa,
        plantsHa,
        context,
        calculationVersion,
        config,
        timestamp
      })
    };

    return result;
  }

  /**
   * Resultado NO SOLUTION: nunca se fuerza una formulación (§11, §27.5).
   */
  _buildNoSolution({
    solveResult,
    sources,
    requirements,
    areaHa,
    plantsHa,
    context,
    calculationVersion,
    config
  }) {
    const timestamp = new Date().toISOString();
    return {
      status: 'no_solution',
      formulation_status: solveResult.status,

      crop: context.crop?.toObject ? context.crop.toObject() : (context.crop ?? null),
      phenological_stage: context.stage?.toObject
        ? context.stage.toObject()
        : (context.stage ?? null),
      target_yield_t_ha: context.targetYieldTHa ?? null,
      methodology: context.methodology ?? 'auto',
      soil_analysis: context.soilAnalysis?.toObject
        ? context.soilAnalysis.toObject()
        : (context.soilAnalysis ?? null),

      lot_context: { area_ha: areaHa, plants_per_ha: plantsHa },

      requirements,
      uncovered_nutrients: solveResult.uncoveredNutrients,
      message:
        'No existe una combinación factible con los fertilizantes seleccionados para cubrir todos los requerimientos nutricionales.',
      missing_sources: solveResult.uncoveredNutrients.map((nutrient) => ({
        nutrient,
        reason: 'sin fuente disponible'
      })),

      products: [],
      nutrient_balance: {},
      total_cost: null,
      warnings: [...new Set(solveResult.warnings)],
      calculation_version: calculationVersion,
      engine_version: '2.0.0',
      formulation_config_version: FORMULATION_CONFIG_VERSION,
      calculated_at: timestamp,

      snapshot: {
        lot_context: { area_ha: areaHa, plants_per_ha: plantsHa },
        nutrient_requirements: { ...requirements },
        fertilizer_sources: sources.map((s) => s.toObject()),
        optimization_config: { ...config },
        uncovered_nutrients: [...solveResult.uncoveredNutrients],
        engine_version: '2.0.0',
        calculation_version: calculationVersion,
        calculated_at: timestamp
      }
    };
  }

  /**
   * Snapshot inmutable de TODA la formulación (§25).
   * Si mañana cambia el algoritmo, la recomendación histórica no cambia.
   */
  _buildSnapshot({
    solveResult,
    sources,
    requirements,
    products,
    nutrient_balance,
    areaHa,
    plantsHa,
    context,
    calculationVersion,
    config,
    timestamp
  }) {
    return {
      lot_context: {
        area_ha: areaHa,
        plants_per_ha: plantsHa,
        lot_id: context.lotId ?? null,
        farm_id: context.farmId ?? null
      },
      soil_analysis: context.soilAnalysis?.toObject
        ? context.soilAnalysis.toObject()
        : (context.soilAnalysis ?? null),
      crop: context.crop?.toObject ? context.crop.toObject() : (context.crop ?? null),
      phenological_stage: context.stage?.toObject
        ? context.stage.toObject()
        : (context.stage ?? null),
      yield_target: context.targetYieldTHa ?? null,

      nutrient_requirements: Object.fromEntries(
        Object.entries(requirements).map(([k, v]) => [
          k,
          {
            required_kg_ha: v,
            minimum_kg_ha: parseFloat(((v * config.coverageRanges.minPct) / 100).toFixed(4)),
            target_kg_ha: parseFloat(((v * config.coverageRanges.targetPct) / 100).toFixed(4)),
            maximum_kg_ha: parseFloat(((v * config.coverageRanges.maxPct) / 100).toFixed(4)),
            source: 'diagnosis_engine'
          }
        ])
      ),

      fertilizer_sources: sources.map((s) => s.toObject()),
      fertilizer_compositions: Object.fromEntries(sources.map((s) => [s.id, { ...s.composition }])),

      optimization_config: { ...config },
      objective_parts: solveResult.objectiveParts ?? null,

      calculated_doses: solveResult.doses.map((d) => ({ ...d })),
      commercial_adjustments: products.map((p) => ({
        product_id: p.product_id,
        presentation_kg: p.presentation_kg,
        packages: p.total_packages,
        actual_dose_kg_ha: p.actual_dose_kg_ha
      })),
      actual_contributions: products.reduce((acc, p) => {
        for (const [nutrient, value] of Object.entries(p.contributions)) {
          acc[nutrient] = parseFloat(((acc[nutrient] ?? 0) + value).toFixed(6));
        }
        return acc;
      }, {}),
      coverage_percentages: Object.fromEntries(
        Object.entries(nutrient_balance).map(([k, b]) => [k, b.coverage])
      ),
      costs: {
        total_cost: products.reduce((s, p) => s + (p.cost ?? 0), 0) || null,
        per_product: Object.fromEntries(products.map((p) => [p.product_id, p.cost]))
      },

      engine_version: '2.0.0',
      calculation_version: calculationVersion,
      calculated_at: timestamp
    };
  }
}
