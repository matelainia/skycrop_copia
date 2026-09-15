/**
 * Model class representing Fuel logs
 */
export class FuelRecord {
  constructor({
    id = null,
    maquinariaId = '',
    codigoId = '',
    name = '',
    type = '',
    operatorName = '',
    fuelConsumptionRate = '15.5 L/h',
    hoursWorked = 0,
    fuelConsumed = 0,
    cost = 0,
    status = '',
    date = null,
    empresaId = null
  } = {}) {
    this.id = id;
    this.maquinariaId = maquinariaId;
    this.codigoId = codigoId;
    this.name = name;
    this.type = type;
    this.operatorName = operatorName;
    this.fuelConsumptionRate = fuelConsumptionRate;
    this.hoursWorked = Number(hoursWorked) || 0;
    this.fuelConsumed = Number(fuelConsumed) || 0;
    this.cost = Number(cost) || 0;
    this.status = status;
    this.date = date || new Date().toISOString().split('T')[0];
    this.empresaId = empresaId;
  }

  /**
   * Factory para filas de maquinaria_combustible (contrato 052 §2.4).
   * No rompe el uso actual in-memory (derivado de flota/jornadas).
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new FuelRecord({
      id: row.id,
      maquinariaId: row.maquinaria_id,
      fuelConsumed: row.cantidad,
      cost: row.costo_total,
      date: row.fecha ? String(row.fecha).substring(0, 10) : null,
      operatorName: row.observacion || '',
      empresaId: row.company_id || null
    });
  }
}
