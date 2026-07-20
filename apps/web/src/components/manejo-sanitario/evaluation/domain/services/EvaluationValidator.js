/**
 * Servicio de dominio encargado de validar las transiciones de estado de la máquina
 * de estados del asistente de evaluación, y verificar reglas de consistencia de datos.
 */
export class EvaluationValidator {
  /**
   * Valida los datos del Paso 1: Información del lote.
   * @param {Object} data
   * @param {string} data.companyId
   * @param {string} data.predioId
   * @param {string} data.loteId
   * @returns {{ isValid: boolean, errors: Object }}
   */
  static validateStep1(data) {
    const errors = {};
    if (!data.companyId) errors.companyId = 'Debe seleccionar una empresa';
    if (!data.predioId) errors.predioId = 'Debe seleccionar un predio';
    if (!data.loteId) errors.loteId = 'Debe seleccionar un lote';

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida los datos del Paso 2: Tipo de evaluación.
   * @param {Object} data
   * @param {string} data.tipoMonitoreo
   * @param {string} data.objetoEvaluacionId
   * @returns {{ isValid: boolean, errors: Object }}
   */
  static validateStep2(data) {
    const errors = {};
    if (!data.tipoMonitoreo) errors.tipoMonitoreo = 'Debe seleccionar el tipo de monitoreo';
    if (!data.objetoEvaluacionId) errors.objetoEvaluacionId = 'Debe seleccionar el objeto de evaluación';

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida los datos del Paso 3: Anotación de datos de variables.
   * @param {Object} valores - Valores ingresados para las variables del protocolo
   * @param {Object} protocol - Instancia de EvaluationProtocol
   * @param {number} puntosEvaluados - Puntos/plantas evaluadas
   * @returns {{ isValid: boolean, errors: Object }}
   */
  static validateStep3(valores, protocol, puntosEvaluados) {
    const errors = {};
    
    if (!puntosEvaluados || puntosEvaluados <= 0) {
      errors.puntosEvaluados = 'Debe registrar al menos un punto evaluado';
    }

    if (!protocol || !Array.isArray(protocol.variables)) {
      return { isValid: Object.keys(errors).length === 0, errors };
    }

    protocol.variables.forEach(variable => {
      const val = valores[variable.clave];
      
      // Validar obligatoriedad
      if (variable.obligatorio && (val === undefined || val === null || val === '')) {
        errors[variable.clave] = `La variable "${variable.etiqueta}" es obligatoria`;
        return;
      }

      // Validar rangos numéricos si se ingresó un valor
      if (variable.tipo === 'number' && val !== undefined && val !== null && val !== '') {
        const num = parseFloat(val);
        if (isNaN(num)) {
          errors[variable.clave] = 'Debe ingresar un valor numérico';
        } else {
          if (variable.min !== null && variable.min !== undefined && num < variable.min) {
            errors[variable.clave] = `El valor mínimo permitido es ${variable.min}`;
          }
          if (variable.max !== null && variable.max !== undefined && num > variable.max) {
            errors[variable.clave] = `El valor máximo permitido es ${variable.max}`;
          }
        }
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida el Paso 4: Revisión final.
   * @param {Object} data
   * @param {string} data.responsable
   * @param {string} data.fecha
   * @returns {{ isValid: boolean, errors: Object }}
   */
  static validateStep4(data) {
    const errors = {};
    if (!data.responsable || !data.responsable.trim()) {
      errors.responsable = 'El responsable de la evaluación es requerido';
    }
    if (!data.fecha) {
      errors.fecha = 'La fecha de la evaluación es requerida';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}
