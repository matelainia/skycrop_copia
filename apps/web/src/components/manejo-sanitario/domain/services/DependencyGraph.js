/**
 * DependencyGraph
 * ===============
 * Grafo Acíclico Dirigido (DAG) de dependencias entre indicadores.
 *
 * PROPÓSITO:
 *   Determinar el orden correcto de cálculo de los indicadores de un protocolo,
 *   garantizando que un indicador que depende de otro se calcule DESPUÉS de él.
 *
 *   Ejemplo:
 *     Incidencia = (BARRENADAS / TOTAL) * 100          → solo depende de variables
 *     IndiceRiesgo = Incidencia * PESO_LOTE             → depende de Incidencia
 *     RiesgoNormalizado = ROUND(IndiceRiesgo / 10, 2)  → depende de IndiceRiesgo
 *
 *   Orden correcto:  Incidencia → IndiceRiesgo → RiesgoNormalizado
 *
 * CONSTRUCCIÓN:
 *   El grafo se construye UNA SOLA VEZ al publicar el protocolo y se
 *   almacena serializado junto a él para evitar recalcular el orden
 *   en cada evaluación de campo.
 *
 * DETECCIÓN DE CICLOS:
 *   Si se detecta un ciclo (A depende de B y B depende de A), se lanza
 *   un error que impide la publicación del protocolo.
 */

export class DependencyGraph {

  /**
   * Construye el grafo a partir de los indicadores del protocolo.
   *
   * @param {Array} indicadores - Array de indicadores con { clave, formula, estrategia_tipo, configuracion }
   * @param {string[]} variableKeys - Claves de variables declaradas en el protocolo
   * @returns {DependencyGraph}
   */
  static build(indicadores = [], variableKeys = []) {
    const graph = new DependencyGraph();
    const indicadorClaves = new Set(indicadores.map(i => i.clave));
    const variableSet = new Set(variableKeys);

    for (const indicador of indicadores) {
      graph._nodes.set(indicador.clave, indicador);
      graph._edges.set(indicador.clave, new Set());

      // Extraer referencias a OTROS INDICADORES dentro de la fórmula/configuración
      const referencias = DependencyGraph._extractIndicatorRefs(indicador, indicadorClaves);
      for (const ref of referencias) {
        graph._edges.get(indicador.clave).add(ref);
      }
    }

    // Validar que el grafo es acíclico antes de retornarlo
    const { ciclos } = graph._detectCycles();
    if (ciclos.length > 0) {
      throw new Error(
        `[DependencyGraph] Dependencias circulares detectadas: ${ciclos.map(c => c.join(' → ')).join(' | ')}`
      );
    }

    return graph;
  }

  constructor() {
    /** @type {Map<string, Object>} clave → objeto indicador */
    this._nodes = new Map();
    /** @type {Map<string, Set<string>>} clave → Set de claves de las que depende */
    this._edges = new Map();
    /** @type {string[]|null} Orden de ejecución en caché */
    this._sortedOrder = null;
  }

  /**
   * Retorna el orden de ejecución óptimo de los indicadores
   * (Ordenamiento Topológico - Algoritmo de Kahn).
   *
   * @returns {string[]} Array de claves de indicadores en orden de cálculo
   */
  getSortedOrder() {
    if (this._sortedOrder) return this._sortedOrder;

    const inDegree = new Map();
    const adjacency = new Map(); // quien depende de mí

    for (const [key] of this._nodes) {
      inDegree.set(key, 0);
      adjacency.set(key, new Set());
    }

    for (const [key, deps] of this._edges) {
      for (const dep of deps) {
        if (this._nodes.has(dep)) {
          inDegree.set(key, (inDegree.get(key) || 0) + 1);
          adjacency.get(dep).add(key);
        }
      }
    }

    // Cola de nodos con grado de entrada = 0 (sin dependencias)
    const queue = [];
    for (const [key, degree] of inDegree) {
      if (degree === 0) queue.push(key);
    }
    queue.sort(); // Orden determinístico entre iguales

    const sorted = [];
    while (queue.length) {
      const node = queue.shift();
      sorted.push(node);
      const neighbors = adjacency.get(node) || new Set();
      for (const neighbor of [...neighbors].sort()) {
        const newDegree = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== this._nodes.size) {
      throw new Error('[DependencyGraph] No se pudo ordenar el grafo: posible ciclo no detectado');
    }

    this._sortedOrder = sorted;
    return sorted;
  }

  /**
   * Retorna las dependencias directas de un indicador.
   * @param {string} clave
   * @returns {string[]} Claves de indicadores de los que depende
   */
  getDependencies(clave) {
    return [...(this._edges.get(clave) || [])];
  }

  /**
   * Verifica si hay dependencias circulares en el grafo.
   * @returns {{ tiene: boolean, ciclos: string[][] }}
   */
  _detectCycles() {
    const UNVISITED = 0, IN_STACK = 1, DONE = 2;
    const state = new Map();
    const ciclos = [];

    for (const [key] of this._nodes) {
      state.set(key, UNVISITED);
    }

    const dfs = (node, path) => {
      state.set(node, IN_STACK);
      path.push(node);

      for (const dep of (this._edges.get(node) || [])) {
        if (!this._nodes.has(dep)) continue; // dep es variable, no indicador
        if (state.get(dep) === IN_STACK) {
          // Encontramos un ciclo — capturar el camino
          const cycleStart = path.indexOf(dep);
          ciclos.push([...path.slice(cycleStart), dep]);
        } else if (state.get(dep) === UNVISITED) {
          dfs(dep, path);
        }
      }

      path.pop();
      state.set(node, DONE);
    };

    for (const [key] of this._nodes) {
      if (state.get(key) === UNVISITED) dfs(key, []);
    }

    return { tiene: ciclos.length > 0, ciclos };
  }

  /**
   * Serializa el grafo para almacenarlo junto al protocolo en la BD.
   * @returns {Object}
   */
  serialize() {
    const edges = {};
    for (const [key, deps] of this._edges) {
      edges[key] = [...deps];
    }
    return {
      sortedOrder: this.getSortedOrder(),
      edges,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Restaura un grafo previamente serializado (sin recalcular el orden).
   * @param {Object} serialized
   * @param {Array} indicadores
   * @returns {DependencyGraph}
   */
  static fromSerialized(serialized, indicadores = []) {
    const graph = new DependencyGraph();
    for (const ind of indicadores) {
      graph._nodes.set(ind.clave, ind);
    }
    for (const [key, deps] of Object.entries(serialized.edges || {})) {
      graph._edges.set(key, new Set(deps));
    }
    graph._sortedOrder = serialized.sortedOrder || null;
    return graph;
  }

  // ─── EXTRACCIÓN DE REFERENCIAS ──────────────────────────────────────────────

  /**
   * Extrae las claves de otros indicadores referenciados en la fórmula
   * o en la configuración de la estrategia del indicador.
   *
   * @param {Object} indicador
   * @param {Set<string>} indicadorClaves — Claves de indicadores conocidos del protocolo
   * @returns {Set<string>}
   */
  static _extractIndicatorRefs(indicador, indicadorClaves) {
    const refs = new Set();
    const { formula, configuracion = {} } = indicador;

    // Extraer de fórmula string (ej: "INCIDENCIA * 1.5 + BARRENADAS")
    if (formula && typeof formula === 'string') {
      // Tokenizar identificadores
      const identifiers = formula.match(/\b[A-Z_][A-Z0-9_]*\b/g) || [];
      for (const id of identifiers) {
        if (indicadorClaves.has(id) && id !== indicador.clave) {
          refs.add(id);
        }
      }
    }

    // Extraer de configuración de estrategia (para FormulaStrategy con variables_formula)
    if (configuracion?.variables_formula) {
      for (const clave of Object.values(configuracion.variables_formula)) {
        const upper = String(clave).toUpperCase();
        if (indicadorClaves.has(upper) && upper !== indicador.clave) {
          refs.add(upper);
        }
      }
    }

    return refs;
  }
}
