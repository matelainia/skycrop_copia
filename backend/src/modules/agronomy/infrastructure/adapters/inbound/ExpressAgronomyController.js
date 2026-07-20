export class ExpressAgronomyController {
  constructor(
    getFormularioUseCase,
    getCropsUseCase,
    getRecommendationsUseCase,
    agronomyRepository
  ) {
    this.getFormularioUseCase = getFormularioUseCase;
    this.getCropsUseCase = getCropsUseCase;
    this.getRecommendationsUseCase = getRecommendationsUseCase;
    this.repo = agronomyRepository;
  }

  /**
   * GET /api/v1/agronomia/lotes/:id/formulario-monitoreo
   * Endpoint atómico: retorna todo lo necesario para el formulario dinámico.
   */
  getFormularioMonitoreo = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, error: 'lote_id requerido' });
      }
      const result = await this.getFormularioUseCase.execute(id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/cultivos
   * Catálogo maestro de cultivos activos.
   */
  getCultivos = async (req, res, next) => {
    try {
      const data = await this.getCropsUseCase.execute();
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/cultivos/:cultivoId/estados-fenologicos
   * Estados fenológicos de un cultivo.
   */
  getEstadosFenologicos = async (req, res, next) => {
    try {
      const { cultivoId } = req.params;
      const data = await this.repo.getEstadosFenologicos(cultivoId);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/objetos
   * Catálogo de objetos de evaluación, con filtros opcionales.
   * Query params: cultivo_id, estado_fenologico_id
   */
  getObjetos = async (req, res, next) => {
    try {
      const { cultivo_id, estado_fenologico_id } = req.query;
      const data = await this.repo.getObjetosEvaluacion(
        cultivo_id || null,
        estado_fenologico_id || null
      );
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/objetos/:objetoId/recomendaciones
   * Tratamientos e ingredientes activos para un objeto de evaluación.
   */
  getRecomendaciones = async (req, res, next) => {
    try {
      const { objetoId } = req.params;
      const data = await this.getRecommendationsUseCase.execute(objetoId);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
