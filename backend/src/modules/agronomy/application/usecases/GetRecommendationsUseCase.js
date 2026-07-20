export class GetRecommendationsUseCase {
  constructor(agronomyRepository) {
    this.repo = agronomyRepository;
  }

  /**
   * Retorna los tratamientos recomendados para un objeto de evaluación.
   * Los tratamientos están vinculados a INGREDIENTES ACTIVOS, no a marcas comerciales.
   * El frontend o el módulo de inventario se encarga de cruzar con los productos en bodega.
   */
  async execute(objetoEvaluacionId) {
    const tratamientos = await this.repo.getTratamientos(objetoEvaluacionId);

    // Agrupar por tipo de control para facilitar el renderizado
    const grupos = {};
    for (const t of tratamientos) {
      if (!grupos[t.tipo_control]) grupos[t.tipo_control] = [];
      grupos[t.tipo_control].push({
        id: t.id,
        ingrediente_activo: t.ingrediente_activo,
        descripcion: t.descripcion,
        dosis_recomendada: t.dosis_recomendada,
        intervalo_dias: t.intervalo_dias,
        codigo_frac: t.codigo_frac,
        codigo_irac: t.codigo_irac,
        codigo_hrac: t.codigo_hrac,
        precauciones: t.precauciones
      });
    }

    return {
      objeto_evaluacion_id: objetoEvaluacionId,
      grupos_control: grupos,
      total_tratamientos: tratamientos.length
    };
  }
}
