export class ExpressProductController {
  constructor(searchProductsUseCase, getProductDetailsUseCase) {
    this.searchProductsUseCase = searchProductsUseCase;
    this.getProductDetailsUseCase = getProductDetailsUseCase;
  }

  /**
   * GET /api/productos (o /api/v1/productos)
   */
  search = async (req, res, next) => {
    try {
      const q = req.query.q || '';
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;

      const result = await this.searchProductsUseCase.execute(q, limit);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/productos/:id (o /api/v1/productos/:id)
   */
  getById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.getProductDetailsUseCase.execute(id);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export default ExpressProductController;
