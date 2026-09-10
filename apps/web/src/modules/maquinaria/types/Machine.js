/**
 * Model class for Machinery Fleet Equipments (Maquinaria)
 */
export class Machine {
  constructor({
    id = null,
    codigoId = '',
    name = '',
    type = 'Tractor',
    status = 'Disponible',
    operatorName = null,
    currentTask = null,
    currentLot = null,
    lastMaintenance = null,
    nextMaintenance = null,
    nextMaintenanceHours = 250,
    hoursOfOperation = 0,
    hoursToday = 0,
    fuelConsumption = '15.5 L/h',
    costOperator = 15.0,
    costFuel = 12.0,
    costMaintenance = 8.0,
    costDepreciation = 5.0,
    photoUrl = null,
    empresaId = null,
    activo = true
  } = {}) {
    this.id = id;
    this.codigoId = codigoId;
    this.name = name;
    this.type = type;
    this.status = status;
    this.operatorName = operatorName;
    this.currentTask = currentTask;
    this.currentLot = currentLot;
    this.lastMaintenance = lastMaintenance;
    this.nextMaintenance = nextMaintenance;
    this.nextMaintenanceHours = Number(nextMaintenanceHours) || 0;
    this.hoursOfOperation = Number(hoursOfOperation) || 0;
    this.hoursToday = Number(hoursToday) || 0;
    this.fuelConsumption = fuelConsumption;
    this.costOperator = Number(costOperator) || 0;
    this.costFuel = Number(costFuel) || 0;
    this.costMaintenance = Number(costMaintenance) || 0;
    this.costDepreciation = Number(costDepreciation) || 0;
    this.photoUrl = photoUrl;
    this.empresaId = empresaId;
    this.activo = activo;
  }

  /**
   * Factory method to parse database rows to Machine object instances
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new Machine({
      id: row.id,
      codigoId: row.codigo_id,
      name: row.name,
      type: row.type,
      status: row.status,
      operatorName: row.operator_name,
      currentTask: row.current_task,
      currentLot: row.current_lot,
      lastMaintenance: row.last_maintenance,
      nextMaintenance: row.next_maintenance,
      nextMaintenanceHours: row.next_maintenance_hours,
      hoursOfOperation: row.hours_of_operation,
      hoursToday: row.hours_today,
      fuelConsumption: row.fuel_consumption,
      costOperator: row.cost_operator,
      costFuel: row.cost_fuel,
      costMaintenance: row.cost_maintenance,
      costDepreciation: row.cost_depreciation,
      photoUrl: row.photo_url || null,
      empresaId: row.company_id || null,
      activo: row.deleted_at ? false : true
    });
  }

  /**
   * Helper to convert client-side model instance to Supabase database formatting
   */
  static toDatabase(machine) {
    // Esquema real 015: company_id NOT NULL, sin empresa_id/activo. company_id
    // via empresaId (UUID empresa) o NULL para que el trigger la complete del JWT.
    return {
      company_id: machine.empresaId || null,
      codigo_id: machine.codigoId?.toUpperCase().trim(),
      name: machine.name?.trim(),
      type: machine.type,
      status: machine.status,
      operator_name: machine.operatorName?.trim() || null,
      current_task: machine.currentTask?.trim() || null,
      current_lot: machine.currentLot?.trim() || null,
      hours_of_operation: Number(machine.hoursOfOperation) || 0,
      hours_today: Number(machine.hoursToday) || 0,
      fuel_consumption: machine.fuelConsumption?.trim() || null,
      cost_operator: Number(machine.costOperator) || 0,
      cost_fuel: Number(machine.costFuel) || 0,
      cost_maintenance: Number(machine.costMaintenance) || 0,
      cost_depreciation: Number(machine.costDepreciation) || 0,
      next_maintenance_hours: Number(machine.nextMaintenanceHours) || 0,
      photo_url: machine.photoUrl || null,
      last_maintenance: machine.lastMaintenance || null,
      next_maintenance: machine.nextMaintenance || null
    };
  }
}
