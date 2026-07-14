import { ValidationError } from '../../../../shared/errors/AppErrors.js';

export class ExpressWeatherController {
  constructor(getWeatherForecastUseCase) {
    this.getWeatherForecastUseCase = getWeatherForecastUseCase;
  }

  /**
   * Endpoint GET /api/weather (o /api/v1/weather)
   */
  getForecast = async (req, res, next) => {
    try {
      const { latitude, longitude } = req.query;

      if (!latitude || !longitude) {
        throw new ValidationError('Coordenadas (latitude y longitude) son requeridas.');
      }

      const latVal = parseFloat(latitude);
      const lonVal = parseFloat(longitude);

      if (isNaN(latVal) || isNaN(lonVal)) {
        throw new ValidationError('Coordenadas numéricas inválidas.');
      }

      const forecast = await this.getWeatherForecastUseCase.execute(latVal, lonVal);

      // Devolver los datos directamente según el formato legacy contratado por el frontend
      return res.json(forecast);
    } catch (err) {
      next(err);
    }
  };
}

export default ExpressWeatherController;
