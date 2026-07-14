class CacheService {
  constructor() {
    this.store = new Map();
  }

  /**
   * Obtiene un elemento de la caché si no ha expirado.
   * @param {string} key Clave única del elemento
   */
  get(key) {
    const cached = this.store.get(key);
    if (!cached) return null;

    if (cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Limpieza perezosa de elementos expirados
    this.store.delete(key);
    return null;
  }

  /**
   * Registra un elemento en la caché.
   * @param {string} key Clave única del elemento
   * @param {*} value Valor a almacenar
   * @param {number} ttlMs Tiempo de vida en milisegundos (defecto 10 minutos)
   */
  set(key, value, ttlMs = 10 * 60 * 1000) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  /**
   * Elimina un elemento específico de la caché.
   * @param {string} key Clave a eliminar
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Limpia toda la caché.
   */
  clear() {
    this.store.clear();
  }
}

export const cacheService = new CacheService();
export default cacheService;
