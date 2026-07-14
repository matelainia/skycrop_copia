export class SearchProductsUseCase {
  constructor(productRepository) {
    this.productRepository = productRepository;
  }

  async execute(query, limit = 15) {
    const term = (query || '').trim();
    const data = await this.productRepository.searchProducts(term, limit);

    // Mapear los datos de base de datos a DTOs legibles por el cliente frontend
    return data.map((p) => ({
      id: p.id,
      nombre: p.nombre_producto,
      tipo: p.clase_producto,
      tipo_formulacion: p.tipo_formulacion,
      ingrediente_activo: p.ingrediente_activo,
      concentracion: p.concentracion,
      categoria_toxicologica: p.categoria_toxicologica,
      registro_ica: p.reg_ica || '—',
      fabricante: '—'
    }));
  }
}

export default SearchProductsUseCase;
