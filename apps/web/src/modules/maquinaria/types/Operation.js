/**
 * Model class for Machinery Operations (Jornadas de Maquinaria)
 */
export class Operation {
  constructor({
    id = null,
    maquinariaId = '',
    maquinariaName = '',
    maquinariaCodigo = '',
    maquinariaPhoto = '',
    maquinariaType = '',
    operator = '',
    lot = '',
    activity = 'Preparación de suelo',
    startTime = null,
    endTime = null,
    startHorometro = 0,
    endHorometro = 0,
    startFuel = 100,
    endFuel = 80,
    calculatedHours = 0,
    calculatedFuelConsumption = 0,
    calculatedCost = 0,
    notes = '',
    status = 'En Progreso',
    empresaId = null
  } = {}) {
    this.id = id;
    this.maquinariaId = maquinariaId;
    this.maquinariaName = maquinariaName;
    this.maquinariaCodigo = maquinariaCodigo;
    this.maquinariaPhoto = maquinariaPhoto;
    this.maquinariaType = maquinariaType;
    this.operator = operator;
    this.lot = lot;
    this.activity = activity;
    this.startTime = startTime;
    this.endTime = endTime;
    this.startHorometro = Number(startHorometro) || 0;
    this.endHorometro = Number(endHorometro) || 0;
    this.startFuel = Number(startFuel) || 0;
    this.endFuel = Number(endFuel) || 0;
    this.calculatedHours = Number(calculatedHours) || 0;
    this.calculatedFuelConsumption = Number(calculatedFuelConsumption) || 0;
    this.calculatedCost = Number(calculatedCost) || 0;
    this.notes = notes;
    this.status = status;
    this.empresaId = empresaId;
  }

  /**
   * Factory method to parse database rows to Operation object instances
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new Operation({
      id: row.id,
      maquinariaId: row.maquinaria_id,
      maquinariaName: row.maquinaria?.name || '',
      maquinariaCodigo: row.maquinaria?.codigo_id || '',
      maquinariaPhoto: row.maquinaria?.photo_url || '',
      maquinariaType: row.maquinaria?.type || '',
      operator: row.operator,
      lot: row.lot,
      activity: row.activity,
      startTime: row.start_time,
      endTime: row.end_time,
      startHorometro: row.start_horometro,
      endHorometro: row.end_horometro,
      startFuel: row.start_fuel,
      endFuel: row.end_fuel,
      calculatedHours: row.calculated_hours,
      calculatedFuelConsumption: row.calculated_fuel_consumption,
      calculatedCost: row.calculated_cost,
      notes: row.notes || '',
      status: row.status,
      empresaId: row.empresa_id
    });
  }

  /**
   * Helper to convert client-side model instance to Supabase database formatting
   */
  static toDatabase(operation) {
    return {
      maquinaria_id: operation.maquinariaId,
      operator: operation.operator?.trim(),
      lot: operation.lot?.trim(),
      activity: operation.activity,
      start_time: operation.startTime,
      end_time: operation.endTime,
      start_horometro: Number(operation.startHorometro) || 0,
      end_horometro: Number(operation.endHorometro) || 0,
      start_fuel: Number(operation.startFuel) || 0,
      end_fuel: Number(operation.endFuel) || 0,
      calculated_hours: Number(operation.calculatedHours) || 0,
      calculated_fuel_consumption: Number(operation.calculatedFuelConsumption) || 0,
      calculated_cost: Number(operation.calculatedCost) || 0,
      notes: operation.notes?.trim() || '',
      status: operation.status,
      empresa_id: operation.empresaId
    };
  }
}
