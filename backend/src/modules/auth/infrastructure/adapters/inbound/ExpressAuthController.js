import { ValidationError } from '../../../../shared/errors/AppErrors.js';
import { AuthenticationError } from '../../../../shared/errors/AppErrors.js';

export class ExpressAuthController {
  constructor(getUserProfileUseCase, processClerkWebhookUseCase) {
    this.getUserProfileUseCase = getUserProfileUseCase;
    this.processClerkWebhookUseCase = processClerkWebhookUseCase;
  }

  /**
   * Endpoint GET /api/auth/me (o /api/v1/auth/me)
   */
  getProfile = async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('No autorizado. Token de Clerk faltante.');
      }
      const clerkToken = authHeader.split(' ')[1];

      const profile = await this.getUserProfileUseCase.execute(clerkToken);

      return res.status(200).json({
        success: true,
        data: profile,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'N/A'
        },
        error: null
      });
    } catch (err) {
      // Mantener compatibilidad estricta con el manejo de la UI frontend para ORGANIZATION_REQUIRED
      if (err instanceof ValidationError && err.message === 'ORGANIZATION_REQUIRED') {
        return res.status(400).json({
          error: 'ORGANIZATION_REQUIRED',
          message: 'Debes seleccionar o crear una organización en Clerk para continuar.'
        });
      }
      next(err);
    }
  };

  /**
   * Endpoint POST /api/webhooks/clerk (o /api/v1/webhooks/clerk)
   */
  handleWebhook = async (req, res, next) => {
    try {
      // req.body debe ser un Buffer crudo (gracias a express.raw en el Router)
      const payloadBuffer = req.body;
      const headers = req.headers;

      const result = await this.processClerkWebhookUseCase.execute(payloadBuffer, headers);

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export default ExpressAuthController;
