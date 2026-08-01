/**
 * EvaluationStateMachine
 * ======================
 * Máquina de estados formal del ciclo de vida de una Evaluación Agronómica.
 *
 * Estados válidos:
 *   BORRADOR     → Evaluación creada preliminarmente o recuperada de borrador.
 *   CAPTURANDO   → Usuario activamente digitando datos en el formulario.
 *   VALIDADA     → Cumple todas las validaciones (variables obligatorias, muestra mínima).
 *   CONSOLIDADA  → Snapshot inmutable creado. Datos NO modificables.
 *   APROBADA     → Revisada y autorizada por responsable agronómico.
 *   CERRADA      → Registro cerrado definitivamente.
 *   ARCHIVADA    → Almacenada en historial de largo plazo.
 *
 * Transiciones válidas:
 *   BORRADOR     → CAPTURANDO
 *   CAPTURANDO   → VALIDADA  | BORRADOR
 *   VALIDADA     → CONSOLIDADA | CAPTURANDO
 *   CONSOLIDADA  → APROBADA
 *   APROBADA     → CERRADA
 *   CERRADA      → ARCHIVADA
 *
 * Restricciones por estado (qué acciones están bloqueadas):
 *   CONSOLIDADA / APROBADA / CERRADA / ARCHIVADA → No permitir edición de variables
 */

export const EVALUATION_STATES = Object.freeze({
  BORRADOR:     'BORRADOR',
  CAPTURANDO:   'CAPTURANDO',
  VALIDADA:     'VALIDADA',
  CONSOLIDADA:  'CONSOLIDADA',
  APROBADA:     'APROBADA',
  CERRADA:      'CERRADA',
  ARCHIVADA:    'ARCHIVADA'
});

// Transiciones válidas por estado
const VALID_TRANSITIONS = Object.freeze({
  [EVALUATION_STATES.BORRADOR]:     [EVALUATION_STATES.CAPTURANDO],
  [EVALUATION_STATES.CAPTURANDO]:   [EVALUATION_STATES.VALIDADA, EVALUATION_STATES.BORRADOR],
  [EVALUATION_STATES.VALIDADA]:     [EVALUATION_STATES.CONSOLIDADA, EVALUATION_STATES.CAPTURANDO],
  [EVALUATION_STATES.CONSOLIDADA]:  [EVALUATION_STATES.APROBADA],
  [EVALUATION_STATES.APROBADA]:     [EVALUATION_STATES.CERRADA],
  [EVALUATION_STATES.CERRADA]:      [EVALUATION_STATES.ARCHIVADA],
  [EVALUATION_STATES.ARCHIVADA]:    []  // Estado terminal
});

// Acciones permitidas por estado
const STATE_PERMISSIONS = Object.freeze({
  [EVALUATION_STATES.BORRADOR]: {
    canEditVariables:   true,
    canEditMetadata:    true,
    canSave:            true,
    canApprove:         false,
    canClose:           false,
    canArchive:         false,
    canDelete:          true
  },
  [EVALUATION_STATES.CAPTURANDO]: {
    canEditVariables:   true,
    canEditMetadata:    true,
    canSave:            true,
    canApprove:         false,
    canClose:           false,
    canArchive:         false,
    canDelete:          true
  },
  [EVALUATION_STATES.VALIDADA]: {
    canEditVariables:   true,
    canEditMetadata:    true,
    canSave:            true,
    canApprove:         true,
    canClose:           false,
    canArchive:         false,
    canDelete:          false
  },
  [EVALUATION_STATES.CONSOLIDADA]: {
    canEditVariables:   false,   // ← Bloqueado: datos inmutables
    canEditMetadata:    false,
    canSave:            false,
    canApprove:         true,
    canClose:           false,
    canArchive:         false,
    canDelete:          false
  },
  [EVALUATION_STATES.APROBADA]: {
    canEditVariables:   false,
    canEditMetadata:    false,
    canSave:            false,
    canApprove:         false,
    canClose:           true,
    canArchive:         false,
    canDelete:          false
  },
  [EVALUATION_STATES.CERRADA]: {
    canEditVariables:   false,
    canEditMetadata:    false,
    canSave:            false,
    canApprove:         false,
    canClose:           false,
    canArchive:         true,
    canDelete:          false
  },
  [EVALUATION_STATES.ARCHIVADA]: {
    canEditVariables:   false,
    canEditMetadata:    false,
    canSave:            false,
    canApprove:         false,
    canClose:           false,
    canArchive:         false,
    canDelete:          false
  }
});

// Etiquetas en español para la UI
const STATE_LABELS = Object.freeze({
  [EVALUATION_STATES.BORRADOR]:    'Borrador',
  [EVALUATION_STATES.CAPTURANDO]:  'Capturando',
  [EVALUATION_STATES.VALIDADA]:    'Validada',
  [EVALUATION_STATES.CONSOLIDADA]: 'Consolidada',
  [EVALUATION_STATES.APROBADA]:    'Aprobada',
  [EVALUATION_STATES.CERRADA]:     'Cerrada',
  [EVALUATION_STATES.ARCHIVADA]:   'Archivada'
});

// Colores semáforo para la UI
const STATE_COLORS = Object.freeze({
  [EVALUATION_STATES.BORRADOR]:    { color: '#92400e', bg: 'rgba(146,64,14,0.12)',   icon: '📝' },
  [EVALUATION_STATES.CAPTURANDO]:  { color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)',   icon: '✏️' },
  [EVALUATION_STATES.VALIDADA]:    { color: '#7c3aed', bg: 'rgba(124,58,237,0.12)',  icon: '✅' },
  [EVALUATION_STATES.CONSOLIDADA]: { color: '#15803d', bg: 'rgba(21,128,61,0.12)',   icon: '🔒' },
  [EVALUATION_STATES.APROBADA]:    { color: '#0369a1', bg: 'rgba(3,105,161,0.12)',   icon: '✔️' },
  [EVALUATION_STATES.CERRADA]:     { color: '#475569', bg: 'rgba(71,85,105,0.12)',   icon: '🚫' },
  [EVALUATION_STATES.ARCHIVADA]:   { color: '#334155', bg: 'rgba(51,65,85,0.12)',    icon: '📦' }
});

export class EvaluationStateMachine {
  /**
   * @param {string} initialState - Estado inicial (por defecto BORRADOR)
   */
  constructor(initialState = EVALUATION_STATES.BORRADOR) {
    if (!EVALUATION_STATES[initialState]) {
      throw new Error(`Estado inválido: "${initialState}"`);
    }
    this._state = initialState;
    this._history = [{ state: initialState, timestamp: new Date().toISOString() }];
  }

  /** Estado actual */
  get state() { return this._state; }

  /** Historial de transiciones */
  get history() { return [...this._history]; }

  /** Permisos del estado actual */
  get permissions() { return STATE_PERMISSIONS[this._state]; }

  /** Etiqueta legible del estado actual */
  get label() { return STATE_LABELS[this._state]; }

  /** Colores del estado actual para la UI */
  get uiStyle() { return STATE_COLORS[this._state]; }

  /**
   * Verifica si la transición al estado objetivo es válida.
   * @param {string} targetState
   * @returns {boolean}
   */
  canTransitionTo(targetState) {
    return VALID_TRANSITIONS[this._state]?.includes(targetState) ?? false;
  }

  /**
   * Realiza la transición al estado objetivo.
   * @param {string} targetState
   * @throws {Error} Si la transición no está permitida
   */
  transitionTo(targetState) {
    if (!this.canTransitionTo(targetState)) {
      throw new Error(
        `Transición inválida: "${this._state}" → "${targetState}". ` +
        `Transiciones permitidas desde ${this._state}: [${VALID_TRANSITIONS[this._state]?.join(', ') || 'ninguna'}]`
      );
    }
    const previous = this._state;
    this._state = targetState;
    this._history.push({
      from:      previous,
      to:        targetState,
      timestamp: new Date().toISOString()
    });
    return { from: previous, to: targetState };
  }

  /**
   * Verifica si el estado actual bloquea la edición de variables.
   * @returns {boolean}
   */
  isLocked() {
    return !this.permissions.canEditVariables;
  }

  /**
   * Retorna las transiciones posibles desde el estado actual.
   * @returns {string[]}
   */
  possibleTransitions() {
    return [...(VALID_TRANSITIONS[this._state] || [])];
  }

  /**
   * Determina el estado apropiado según el paso del wizard.
   * Mapeo: paso del wizard → estado de la máquina.
   * @param {number} wizardStep
   * @returns {string}
   */
  static fromWizardStep(wizardStep) {
    const map = {
      1: EVALUATION_STATES.BORRADOR,
      2: EVALUATION_STATES.CAPTURANDO,
      3: EVALUATION_STATES.CAPTURANDO,
      4: EVALUATION_STATES.VALIDADA
    };
    return map[wizardStep] || EVALUATION_STATES.BORRADOR;
  }

  /**
   * Crea una instancia desde un valor de base de datos.
   * @param {string} dbStatus - Valor de la columna evaluation_status
   * @returns {EvaluationStateMachine}
   */
  static fromDatabase(dbStatus) {
    const valid = Object.values(EVALUATION_STATES);
    const status = valid.includes(dbStatus) ? dbStatus : EVALUATION_STATES.BORRADOR;
    return new EvaluationStateMachine(status);
  }

  /**
   * Retorna metadata completa de un estado para uso en la UI.
   * @param {string} state
   * @returns {{ label, color, bg, icon, permissions }}
   */
  static getStateInfo(state) {
    return {
      label:       STATE_LABELS[state]       || state,
      ...STATE_COLORS[state]                 || {},
      permissions: STATE_PERMISSIONS[state]  || {}
    };
  }

  /**
   * Retorna todos los estados en orden.
   */
  static getAllStates() {
    return Object.values(EVALUATION_STATES);
  }
}
