import express from 'express';
import { SupabaseAuthRepository } from '../outbound/SupabaseAuthRepository.js';
import { ClerkAuthService } from '../outbound/ClerkAuthService.js';
import { GetUserProfileUseCase } from '../../../application/usecases/GetUserProfileUseCase.js';
import { ProcessClerkWebhookUseCase } from '../../../application/usecases/ProcessClerkWebhookUseCase.js';
import { ExpressAuthController } from './ExpressAuthController.js';

const router = express.Router();

// 1. Instanciación de componentes de la Arquitectura Hexagonal
const authRepository = new SupabaseAuthRepository();
const clerkService = new ClerkAuthService();

const getUserProfileUseCase = new GetUserProfileUseCase(authRepository, clerkService);
const processClerkWebhookUseCase = new ProcessClerkWebhookUseCase(authRepository, clerkService);

const controller = new ExpressAuthController(getUserProfileUseCase, processClerkWebhookUseCase);

// 2. Definición de rutas
// GET /api/v1/auth/me -> Obtener perfil del usuario y token de Supabase RLS
router.get('/me', controller.getProfile);

// POST /api/v1/auth/webhooks/clerk -> Sincronización mediante webhook de Clerk
// Usamos express.raw para recibir el buffer del payload sin alterar (necesario para verificar firmas en Svix)
router.post('/webhooks/clerk', express.raw({ type: 'application/json' }), controller.handleWebhook);

export const authRouter = router;
export default authRouter;
