export class GetCropsUseCase {
  constructor(agronomyRepository) {
    this.repo = agronomyRepository;
  }

  async execute() {
    const cultivos = await this.repo.getCultivos();
    return cultivos.map((c) => ({
      id: c.id,
      nombre: c.nombre_comun,
      nombre_cientifico: c.nombre_cientifico,
      familia: c.familia_botanica,
      ciclo: c.ciclo_productivo,
      descripcion: c.descripcion,
      foto_url: c.foto_url
    }));
  }
}
