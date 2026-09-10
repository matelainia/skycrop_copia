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
      let limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;
      if (Number.isNaN(limit) || limit < 1) limit = 15;
      limit = Math.min(limit, 50);

      // H2: tenant desde auth; sin tenant solo catalogo global (repositorio).
      const companyId = req.tenant?.companyId || null;
      const result = await this.searchProductsUseCase.execute(q, limit, companyId);
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
      const companyId = req.tenant?.companyId || null;

      const result = await this.getProductDetailsUseCase.execute(id, companyId);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export default ExpressProductController;
