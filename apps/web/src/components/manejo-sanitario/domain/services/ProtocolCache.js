/**
 * ProtocolCache
 * =============
 * Caché en memoria con invalidación por versión para objetos de protocolo.
 *
 * PROBLEMA QUE RESUELVE:
 *   El DependencyGraph y la validación del protocolo son operaciones costosas
 *   que no deberían recalcularse en cada evaluación de campo.
 *   Esta caché mantiene en memoria los protocolos procesados y los invalida
 *   automáticamente cuando cambia la versión (campo `version` o `updated_at`).
 *
 * ESTRATEGIA DE INVALIDACIÓN:
 *   - Clave: protocolo.id
 *   - Versión: protocolo.version || protocolo.updated_at
 *   - Si la versión en caché ≠ versión actual → reemplazar entrada
 *   - Máximo de entradas: configurable (default: 20)
 *   - LRU (Least Recently Used): cuando se alcanza el límite, se expulsa la
 *     entrada menos recientemente usada.
 *
 * USO:
 *   const cached = ProtocolCache.get(protocolo.id, protocolo.version);
 *   if (!cached) {
 *     const processed = buildDependencyGraph(protocolo);
 *     ProtocolCache.set(protocolo.id, protocolo.version, processed);
 *   }
 */

const DEFAULT_MAX_SIZE = 20;

class ProtocolCacheClass {

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    /** @type {Map<string, { version: string, data: any, lastUsed: number }>} */
    this._store    = new Map();
    this._maxSize  = maxSize;
    this._hits     = 0;
    this._misses   = 0;
  }

  /**
   * Recupera una entrada del caché.
   *
   * @param {string} protocoloId — ID único del protocolo
   * @param {string} version     — Versión actual del protocolo
   * @returns {any|null}         — Datos cacheados, o null si no hay entrada válida
   */
  get(protocoloId, version) {
    const entry = this._store.get(protocoloId);

    if (!entry) {
      this._misses++;
      return null;
    }

    // Verificar versión
    if (entry.version !== String(version)) {
      this._store.delete(protocoloId);
      this._misses++;
      return null;
    }

    // Actualizar timestamp LRU
    entry.lastUsed = Date.now();
    this._hits++;
    return entry.data;
  }

  /**
   * Almacena una entrada en el caché.
   *
   * @param {string} protocoloId
   * @param {string} version
   * @param {any}    data         — Cualquier objeto serializable (DependencyGraph, etc.)
   */
  set(protocoloId, version, data) {
    // Si ya existe, actualizar
    if (this._store.has(protocoloId)) {
      this._store.set(protocoloId, { version: String(version), data, lastUsed: Date.now() });
      return;
    }

    // Evicción LRU si se alcanza el límite
    if (this._store.size >= this._maxSize) {
      this._evictLRU();
    }

    this._store.set(protocoloId, { version: String(version), data, lastUsed: Date.now() });
  }

  /**
   * Invalida explícitamente una entrada del caché.
   * @param {string} protocoloId
   */
  invalidate(protocoloId) {
    this._store.delete(protocoloId);
  }

  /**
   * Limpia todo el caché.
   */
  clear() {
    this._store.clear();
    this._hits   = 0;
    this._misses = 0;
  }

  /**
   * Retorna estadísticas del caché para monitoreo/debugging.
   * @returns {{ size: number, maxSize: number, hits: number, misses: number, hitRate: string }}
   */
  stats() {
    const total   = this._hits + this._misses;
    const hitRate = total > 0 ? ((this._hits / total) * 100).toFixed(1) + '%' : 'N/A';
    return {
      size:     this._store.size,
      maxSize:  this._maxSize,
      hits:     this._hits,
      misses:   this._misses,
      hitRate,
    };
  }

  /**
   * Expulsa la entrada menos recientemente usada (LRU).
   * @private
   */
  _evictLRU() {
    let oldestKey  = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this._store) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey  = key;
      }
    }

    if (oldestKey) {
      this._store.delete(oldestKey);
    }
  }
}

/**
 * Instancia singleton del ProtocolCache.
 * Compartida a nivel de módulo (no persiste entre recargas de página).
 */
export const ProtocolCache = new ProtocolCacheClass(DEFAULT_MAX_SIZE);

// Exportar la clase también para tests o instancias personalizadas
export { ProtocolCacheClass };
