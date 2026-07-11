/**
 * Domain-specific Cost Calculator for machinery fleet operations
 */
export class CostCalculator {
  /**
   * Calculate operational cost rate per hour for a machine
   * @param {Object} machine 
   */
  calculateHourlyRate(machine) {
    if (!machine) return 0;
    return (
      (Number(machine.costOperator) || 0) +
      (Number(machine.costFuel) || 0) +
      (Number(machine.costMaintenance) || 0) +
      (Number(machine.costDepreciation) || 0)
    );
  }

  /**
   * Calculate total operation cost
   * @param {number} hours - Hours of work
   * @param {number} hourlyRate - Cost per hour
   */
  calculateOperationCost(hours, hourlyRate) {
    return (Number(hours) || 0) * (Number(hourlyRate) || 0);
  }

  /**
   * Calculate cost per lot based on historical operations
   * @param {Array} operations - List of completed operations
   */
  calculateCostByLot(operations) {
    const lotCosts = {};
    operations.forEach(op => {
      if (op.status === 'Finalizada' && op.lot) {
        const lot = op.lot;
        const cost = Number(op.calculatedCost) || 0;
        const hours = Number(op.calculatedHours) || 0;

        if (!lotCosts[lot]) {
          lotCosts[lot] = { lot, cost: 0, hours: 0 };
        }
        lotCosts[lot].cost += cost;
        lotCosts[lot].hours += hours;
      }
    });
    return Object.values(lotCosts).sort((a, b) => b.cost - a.cost);
  }

  /**
   * Placeholder for future cost per hectare calculation
   */
  calculateCostPerHectare(cropType) {
    const defaultRates = {
      'Soya': 85000,
      'Maíz': 112000
    };
    return (defaultRates[cropType] || 95000);
  }
}

export const costCalculator = new CostCalculator();
export default costCalculator;
