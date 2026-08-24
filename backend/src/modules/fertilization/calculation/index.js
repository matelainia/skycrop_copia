/**
 * index.js — Barrel export del submódulo de cálculo de fertilización.
 * Expone el servicio principal y los tipos clave para uso externo.
 */

// Servicio principal (punto de entrada para el router)
export { FertilizationCalculationService } from './services/FertilizationCalculationService.js';

// Motor (para uso avanzado o testing)
export { FertilizationEngine } from './engine/FertilizationEngine.js';

// Entidades del dominio
export { Crop } from './domain/entities/Crop.js';
export { PhenologicalStage } from './domain/entities/PhenologicalStage.js';
export { Nutrient } from './domain/entities/Nutrient.js';
export { Fertilizer } from './domain/entities/Fertilizer.js';
export { SoilAnalysis } from './domain/entities/SoilAnalysis.js';
export { CropRequirement } from './domain/entities/CropRequirement.js';
export { AgronomicRule } from './domain/entities/AgronomicRule.js';
export { FertilizationResult } from './domain/entities/FertilizationResult.js';

// Value Objects
export { UNIT, UnitConverter } from './domain/value-objects/Unit.js';
export { NutrientRequirement } from './domain/value-objects/NutrientRequirement.js';
export { FertilizerDose } from './domain/value-objects/FertilizerDose.js';
export { SoilNutrient } from './domain/value-objects/SoilNutrient.js';

// Tipos y constantes
export * from './domain/types/fertilization-calc.types.js';

// Errores
export * from './domain/errors/FertilizationErrors.js';
