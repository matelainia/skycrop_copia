import { ValidationError } from '../../../../../shared/errors/AppErrors.js';

export class ExpressGeeController {
  constructor(processGeeIndexUseCase) {
    this.processGeeIndexUseCase = processGeeIndexUseCase;
  }

  /**
   * Endpoint POST /api/gee/index (o /api/v1/gee/index)
   */
  processIndex = async (req, res, next) => {
    try {
      const { coordinates, indexType = 'NDVI', loteId } = req.body;

      if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
        throw new ValidationError('Coordenadas inválidas o ausentes.');
      }

      const result = await this.processGeeIndexUseCase.execute(coordinates, indexType, loteId);

      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export default ExpressGeeController;
