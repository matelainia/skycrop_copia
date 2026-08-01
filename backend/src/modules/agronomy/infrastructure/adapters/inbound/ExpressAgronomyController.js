export class ExpressAgronomyController {
  constructor(
    getFormularioUseCase,
    getCropsUseCase,
    getRecommendationsUseCase,
    agronomyRepository,
    protocolRepository,
    objectRepository,
    protocolService
  ) {
    this.getFormularioUseCase = getFormularioUseCase;
    this.getCropsUseCase = getCropsUseCase;
    this.getRecommendationsUseCase = getRecommendationsUseCase;
    this.agronomyRepo = agronomyRepository;
    this.protocolRepo = protocolRepository;
    this.objectRepo = objectRepository;
    // ProtocolService encapsula las reglas de negocio de protocolos
    this.protocolSvc = protocolService || null;
  }

  // ─── CATÁLOGOS ─────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/agronomia/lotes/:id/formulario-monitoreo
   */
  getFormularioMonitoreo = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, error: 'lote_id requerido' });
      const result = await this.getFormularioUseCase.execute(id);
      if (!result.success) return res.status(404).json(result);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/cultivos
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
   */
  getEstadosFenologicos = async (req, res, next) => {
    try {
      const { cultivoId } = req.params;
      const data = (await this.objectRepo)
        ? this.objectRepo.getEstadosFenologicos(cultivoId)
        : this.agronomyRepo.getEstadosFenologicos(cultivoId);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/objetos
   */
  getObjetos = async (req, res, next) => {
    try {
      const { cultivo_id, estado_fenologico_id } = req.query;
      const repo = this.objectRepo || this.agronomyRepo;
      const data = await repo.getObjetosEvaluacion(
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

  // ─── PROTOCOLOS ────────────────────────────────────────────────────────────

  /** Resuelve si usar protocolSvc (nueva arquitectura) o protocolRepo (legado) */
  get _proto() {
    return this.protocolSvc || this.protocolRepo;
  }

  /**
   * GET /api/v1/agronomia/protocolos
   * Query params: cultivo_id, objeto_id, estado, created_by
   */
  listProtocolos = async (req, res, next) => {
    try {
      const filters = {
        cultivo_id: req.query.cultivo_id || null,
        objeto_id: req.query.objeto_id || null,
        estado: req.query.estado || null,
        created_by: req.query.created_by || null
      };
      // Si hay protocolSvc usa listar(), sino lista directamente del repo
      const data = this.protocolSvc
        ? await this.protocolSvc.listar(filters)
        : await this.protocolRepo.listProtocolos(filters);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/protocolos/:id
   * Retorna el protocolo completamente ensamblado (cabecera + entidades relacionales)
   */
  getProtocoloById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = this.protocolSvc
        ? await this.protocolSvc.obtener(id)
        : await this.protocolRepo.getProtocoloCompleto(id).then((r) => r.cabecera);
      if (!data) return res.status(404).json({ success: false, error: 'Protocolo no encontrado' });
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/agronomia/protocolos
   * Body: { nombre, objeto_evaluacion_id?, objeto_nombre?, cultivo_id,
   *         variables, umbrales, reglas, estado?, ... }
   */
  saveProtocolo = async (req, res, next) => {
    try {
      const payload = req.body;
      const userId = payload.created_by || payload.user_id || 'system';
      const estado = payload.estado || 'borrador';

      if (!payload.objeto_evaluacion_id && !payload.objeto_nombre) {
        return res
          .status(400)
          .json({ success: false, error: 'Objeto de evaluación o su nombre es requerido' });
      }

      const data = this.protocolSvc
        ? await this.protocolSvc.crear(payload, estado, userId)
        : await this.protocolRepo.insertCabecera(payload);

      return res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/agronomia/protocolos/:id
   * Aplica la regla de inmutabilidad: si activo, crea nueva versión.
   * Respuesta incluye { nuevaVersion: boolean } cuando se crea un borrador.
   */
  updateProtocolo = async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      const userId = payload.updated_by || payload.user_id || 'system';

      if (this.protocolSvc) {
        const { protocolo, nuevaVersion } = await this.protocolSvc.editar(id, payload, userId);
        return res.json({
          success: true,
          data: protocolo,
          nuevaVersion,
          message: nuevaVersion
            ? 'El protocolo estaba activo. Se creó una nueva versión en borrador con versión incrementada.'
            : 'Protocolo actualizado correctamente.'
        });
      } else {
        const data = await this.protocolRepo.updateCabecera(id, payload);
        return res.json({ success: true, data });
      }
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/agronomia/protocolos/:id/publicar
   * Transiciona borrador → activo con versionado automático.
   */
  publicarProtocolo = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.body?.user_id || req.query?.user_id || 'system';
      const comentario = req.body?.comentario || null;

      const data = this.protocolSvc
        ? await this.protocolSvc.publicar(id, userId, comentario)
        : await this.protocolRepo.archivarVersionPrevia(null, null, userId, id);

      return res.json({ success: true, data, message: 'Protocolo publicado y activado.' });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/agronomia/protocolos/:id/clone
   */
  cloneProtocolo = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.body?.user_id || req.query?.user_id || 'system';
      const data = this.protocolSvc
        ? await this.protocolSvc.clonar(id, userId)
        : await this.protocolRepo.listProtocolos({ objeto_id: id });
      return res
        .status(201)
        .json({ success: true, data, message: 'Protocolo clonado como borrador' });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/agronomia/protocolos/import
   */
  importProtocolo = async (req, res, next) => {
    try {
      const { protocolo, user_id } = req.body;
      if (!protocolo) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'Se requiere el objeto "protocolo" en el cuerpo de la petición'
          });
      }
      const data = this.protocolSvc
        ? await this.protocolSvc.importar(protocolo, user_id || 'system')
        : await this.protocolRepo.insertCabecera(protocolo);
      return res
        .status(201)
        .json({ success: true, data, message: 'Protocolo importado como borrador' });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/agronomia/protocolos/:objetoId/historial
   */
  getHistorialVersiones = async (req, res, next) => {
    try {
      const { objetoId } = req.params;
      const cultivoId = req.query.cultivo_id || null;
      const data = this.protocolSvc
        ? await this.protocolSvc.historial(objetoId, cultivoId)
        : await this.protocolRepo.getHistorialVersiones(objetoId, cultivoId);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/v1/agronomia/protocolos/:id
   */
  deleteProtocolo = async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = this.protocolSvc
        ? await this.protocolSvc.eliminar(id)
        : await this.protocolRepo.deleteProtocolo(id);
      return res.json({ success: true, data, message: 'Protocolo eliminado correctamente' });
    } catch (err) {
      next(err);
    }
  };
}
