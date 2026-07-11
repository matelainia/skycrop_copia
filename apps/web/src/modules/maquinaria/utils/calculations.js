/**
 * Operational calculations helper formulas
 */

/**
 * Estimate daily fuel consumption in Liters based on operating hours and burn rate
 */
export const calculateFuelBurnToday = (machinery = []) => {
  return machinery.reduce((sum, m) => {
    if (m.status === 'Operando') {
      const burnRate = parseFloat(m.fuelConsumption) || 15.5;
      return sum + burnRate * (m.hoursToday || 6);
    }
    return sum;
  }, 0);
};

/**
 * Estimate daily total hours worked from fleet
 */
export const calculateHoursWorkedToday = (machinery = []) => {
  return machinery.reduce((sum, m) => sum + (m.hoursToday || 0), 0);
};
