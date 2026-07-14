import express from 'express';
import { SupabaseProductRepository } from '../outbound/SupabaseProductRepository.js';
import { SearchProductsUseCase } from '../../../application/usecases/SearchProductsUseCase.js';
import { GetProductDetailsUseCase } from '../../../application/usecases/GetProductDetailsUseCase.js';
import { ExpressProductController } from './ExpressProductController.js';

const router = express.Router();

// 1. Instanciación de componentes de la Arquitectura Hexagonal
const productRepository = new SupabaseProductRepository();

const searchProductsUseCase = new SearchProductsUseCase(productRepository);
const getProductDetailsUseCase = new GetProductDetailsUseCase(productRepository);

const controller = new ExpressProductController(searchProductsUseCase, getProductDetailsUseCase);

// 2. Definición de rutas
// GET /api/v1/productos?q=term -> Búsqueda autocompletado
router.get('/', controller.search);

// GET /api/v1/productos/:id -> Detalle completo del producto
router.get('/:id', controller.getById);

export const productRouter = router;
export default productRouter;
