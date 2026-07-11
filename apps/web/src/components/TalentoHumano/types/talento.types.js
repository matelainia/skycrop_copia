/**
 * @typedef {Object} Trabajador
 * @property {string} id - Unique identifier from DB
 * @property {string} nombres - First/Middle names
 * @property {string} apellidos - Last names
 * @property {string} identificacion - National ID Number (CC)
 * @property {number} [edad] - Age of the worker
 * @property {string} [fechaNacimiento] - Birthdate formatted YYYY-MM-DD
 * @property {string} [fechaContratacion] - Hire date formatted YYYY-MM-DD
 * @property {string} tipoContrato - 'Permanente' | 'Temporal' | 'Contrato' | 'Cosecha'
 * @property {string} rhSanguineo - Blood type (e.g. 'O+', 'AB-')
 * @property {string} tipoEps - Health insurer name
 * @property {string} tipoArl - Work risk insurer name
 * @property {string} [contactoTelefonico] - Contact phone number
 * @property {string} [contactoEmergencia] - Emergency phone number
 * @property {string} [foto] - Base64 encoded avatar image
 * @property {string} [copiaContratoName] - Filename of the uploaded contract copy
 * @property {string} rol - Cargo/Role name
 * @property {string} estado - 'Activa' | 'On Leave' | 'Inactivo'
 */

/**
 * @typedef {Object} Cuadrilla
 * @property {string} id - Unique identifier from DB
 * @property {string} nombre - Squad name
 * @property {string[]} miembros - List of Trabajador IDs belonging to this squad
 */

/**
 * @typedef {Object} Labor
 * @property {string} id - Unique identifier from DB
 * @property {string} titulo - Task heading
 * @property {string} tipo - Task category ('Cosecha', 'Siembra', etc.)
 * @property {string} [descripcion] - Text details
 * @property {string} [lote] - Lot identifier
 * @property {string} fecha - Task execution date (YYYY-MM-DD)
 * @property {string} estado - 'Pendiente' | 'En Curso' | 'Completada' | 'Archivada'
 * @property {string} asignacion - 'cuadrilla' | 'individual'
 * @property {string} [cuadrillaId] - Assigned squad ID if asignacion = 'cuadrilla'
 * @property {string[]} trabajadoresIds - Assigned worker IDs if asignacion = 'individual'
 * @property {number} jornal - Day multiplier (e.g. 1.0, 0.5)
 */

/**
 * @typedef {Object} Curso
 * @property {string} id - Unique identifier
 * @property {string} nombre - Course title
 * @property {string} tipo - Course type ('Seguridad y Salud', 'Técnica', 'Operación')
 * @property {number} total_horas - Total duration of course in hours
 */

/**
 * @typedef {Object} Registro
 * @property {string} id - Unique identifier
 * @property {string} trabajador_id - ID of the worker
 * @property {string} curso_id - ID of the course
 * @property {string} fecha - Date course completed / scheduled (YYYY-MM-DD)
 * @property {string} resultado - Final score (e.g., '10/10')
 * @property {string} estado - 'Completada' | 'En Curso' | 'Vencida'
 * @property {string} [certificado_url] - Certificate Base64 PDF/Image URL
 */

/**
 * @typedef {Object} Nomina
 * @property {string} id - Unique identifier
 * @property {string} trabajador_id - ID of the worker
 * @property {string} periodo - Payroll month (e.g. 'Abril')
 * @property {number} salario_neto - Base salary pay
 * @property {number} horas_extras - Count of overtime hours
 * @property {number} retenciones - Deductible amount
 * @property {number} total_neto - Resulting net pay
 * @property {string} estado - 'Procesando' | 'Completado' | 'Fallido' | 'Vencida'
 * @property {string} [fecha_pago] - Date paid
 * @property {string} [metodo_pago] - 'Transferencia Bancaria' | 'Efectivo' | 'Cheque'
 * @property {string} [comentarios] - Detailed pay notes
 * @property {Trabajador} [trabajador] - Associated worker details object
 */

export {}
