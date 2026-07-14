/**
 * Puerto de Salida (Outbound Port) para el Repositorio de Inventario/Productos.
 */
export class ProductRepositoryPort {
  /**
   * Busca productos fitosanitarios basados en término comercial o ingrediente activo.
   * @param {string} query Término de búsqueda
   * @param {number} limit Límite de resultados
   */
  async searchProducts(query, limit = 15) {
    throw new Error('Método no implementado');
  }

  /**
   * Obtiene la ficha técnica de un producto por su identificador.
   * @param {number} id ID del producto
   */
  async getProductById(id) {
    throw new Error('Método no implementado');
  }

  /**
   * Consulta los ingredientes activos y alertas asociadas para un producto dado.
   * @param {number} productId ID del producto
   * @param {string} targetCat Categoría toxicológica del producto (ej. 'IA', 'IB')
   */
  async getProductIngredients(productId, targetCat) {
    throw new Error('Método no implementado');
  }
}

export default ProductRepositoryPort;
