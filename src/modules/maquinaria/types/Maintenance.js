/**
 * Model class representing Maintenance records
 */
export class Maintenance {
  constructor({
    id = null,
    maquinariaId = '',
    date = null,
    horometro = 0,
    notes = '',
    nextDate = null,
    nextHours = 250,
    empresaId = null
  } = {}) {
    this.id = id;
    this.maquinariaId = maquinariaId;
    this.date = date || new Date().toISOString().split('T')[0];
    this.horometro = Number(horometro) || 0;
    this.notes = notes;
    this.nextDate = nextDate;
    this.nextHours = Number(nextHours) || 250;
    this.empresaId = empresaId;
  }
}
