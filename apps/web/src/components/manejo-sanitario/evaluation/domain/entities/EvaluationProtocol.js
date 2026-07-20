/**
 * Clase de dominio que representa un Protocolo de Evaluación fitosanitaria.
 */
export class EvaluationProtocol {
  constructor({
    id,
    version = '1.0',
    variables = [],
    frecuencia_dias = 14,
    tamanio_muestra = 100,
    metodologia = ''
  }) {
    this.id = id;
    this.version = version;
    this.variables = variables; // Array de { clave, etiqueta, tipo, unidad, obligatorio, escala }
    this.frecuenciaDias = frecuencia_dias;
    this.tamanioMuestra = tamanio_muestra;
    this.metodologia = metodologia;
  }

  /**
   * Retorna las variables requeridas/obligatorias del protocolo.
   */
  getRequiredVariables() {
    return this.variables.filter(v => v.obligatorio);
  }
}
