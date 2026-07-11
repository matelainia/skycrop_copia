/**
 * Decoupled AI Insights Gateway for Machinery predictive suggestions
 */
class MachineryInsights {
  /**
   * Get predictive analytics suggestions for a machine
   * @param {Object} machine 
   * @param {Array} history - List of past operations for the machine
   */
  async getMachineInsights(machine, history = []) {
    // Isolated Mock logic ready to call Gemini API
    const baseConsumption = 15.5;
    const currentRate = parseFloat(machine.fuelConsumption) || baseConsumption;
    const isOverconsuming = currentRate > baseConsumption * 1.1;

    const insights = [];

    if (isOverconsuming) {
      insights.push({
        type: 'WARNING',
        category: 'FUEL_OVERCONSUMPTION',
        message: `El equipo ${machine.codigoId} tiene un consumo de combustible (${machine.fuelConsumption}) superior al promedio base (${baseConsumption} L/h). Se recomienda calibrar inyectores.`
      });
    }

    if (machine.hoursOfOperation > 1000) {
      insights.push({
        type: 'SUGGESTION',
        category: 'PREDICTIVE_MAINTENANCE',
        message: `Por el horómetro acumulado (${machine.hoursOfOperation.toLocaleString()} h), se prevé reemplazo de filtros hidráulicos en las próximas 50 horas.`
      });
    }

    if (history.length > 5) {
      insights.push({
        type: 'INFO',
        category: 'OPERATIONAL_EFFICIENCY',
        message: `Eficiencia promedio del 92% observada en las últimas 5 jornadas. Ritmo estable de trabajo.`
      });
    } else {
      insights.push({
        type: 'INFO',
        category: 'DATA_LIMIT',
        message: `Cargando histórico para análisis predictivo avanzado de IA.`
      });
    }

    return insights;
  }
}

export const machineryInsights = new MachineryInsights();
export default machineryInsights;
