import { evaluateSpraying } from '../utils/rules/sprayingRules';
import { evaluateIrrigation } from '../utils/rules/irrigationRules';
import { evaluateDisease } from '../utils/rules/diseaseRules';
import { evaluateHarvest } from '../utils/rules/harvestRules';

export const WeatherInterpreter = {
  /**
   * Toma los datos climáticos unificados (Contrato V1) y los enriquece
   * con las interpretaciones agronómicas y de labores de campo.
   */
  interpret(weatherData) {
    if (!weatherData || !weatherData.current) {
      return null;
    }

    const { current, daily } = weatherData;

    // Ejecutar evaluaciones de riesgos y labores
    const sprayingEval = evaluateSpraying(current);
    const irrigationEval = evaluateIrrigation(current, daily);
    const diseaseEval = evaluateDisease(current);
    const harvestEval = evaluateHarvest(current, daily);

    // Adjuntar las interpretaciones en una sección estructurada
    return {
      ...weatherData,
      interpretations: {
        spraying: sprayingEval,
        irrigation: irrigationEval,
        disease: diseaseEval,
        harvest: harvestEval
      }
    };
  }
};
