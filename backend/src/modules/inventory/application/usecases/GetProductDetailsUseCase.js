import { NotFoundError } from '../../../../shared/errors/AppErrors.js';

export class GetProductDetailsUseCase {
  constructor(productRepository) {
    this.productRepository = productRepository;
  }

  async execute(productId) {
    const id = parseInt(productId, 10);
    const product = await this.productRepository.getProductById(id);

    if (!product) {
      throw new NotFoundError('Ficha de producto no encontrada.');
    }

    const FALLBACK_ALERTAS = {
      IA: {
        categoria: 'IA',
        titulo: 'PELIGRO EXTREMO (Categoría IA)',
        mensaje:
          'Este ingrediente activo es altamente mortal si se inhala o se tiene exposición prolongada. Es extremadamente peligroso para las personas, entomofauna y animales acuáticos. Su manipulación requiere capacitación, uso obligatorio de EPP completo y prescripción por parte de un ingeniero agrónomo.',
        recomendaciones: [
          'Utilizar EPP completo.',
          'No inhalar vapores ni nieblas.',
          'Evitar el contacto con piel y ojos.',
          'No contaminar fuentes de agua.',
          'Mantener fuera del alcance de niños y animales.'
        ]
      },
      IB: {
        categoria: 'IB',
        titulo: 'ALTA TOXICIDAD (Categoría IB)',
        mensaje:
          'Este ingrediente activo pertenece a la categoría toxicológica IB. Mortal en exposiciones prolongadas, mortal a la entomofauna y animales acuáticos. Utilice EPP completo y evite cualquier exposición directa durante la preparación y aplicación. Su formulación requiere prescripción por parte de un ingeniero agrónomo.',
        recomendaciones: [
          'Utilizar EPP completo.',
          'No inhalar vapores ni nieblas.',
          'Evitar el contacto con piel y ojos.',
          'No contaminar fuentes de agua.',
          'Mantener fuera del alcance de niños y animales.'
        ]
      }
    };

    let ingredientes = [];
    try {
      const rels = await this.productRepository.getProductIngredients(id);
      if (rels && rels.length > 0) {
        ingredientes = rels
          .map((r) => {
            const ing = r.ingrediente;
            if (!ing) return null;

            const targetCat = (product.categoria_toxicologica || '').toUpperCase().trim();
            const prop = Array.isArray(ing.propiedades)
              ? ing.propiedades.find(
                  (p) => (p.categoria_toxicologica || '').toUpperCase().trim() === targetCat
                )
              : null;

            let alerta = null;
            if (prop) {
              alerta = {
                categoria: prop.categoria_toxicologica,
                titulo: prop.titulo_alerta,
                mensaje: prop.mensaje_alerta,
                recomendaciones: prop.recomendaciones
              };
            } else if (
              targetCat === 'IA' ||
              targetCat === 'IB' ||
              targetCat === '1A' ||
              targetCat === '1B'
            ) {
              const normalCat = targetCat.includes('A') ? 'IA' : 'IB';
              alerta = FALLBACK_ALERTAS[normalCat];
            }

            return {
              nombre: ing.nombre,
              concentracion: product.concentracion || '',
              grupo_quimico:
                (product.grupo_quimico || '')
                  .replace(/\r?\n|\r/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim() || '—',
              registro_ica: product.reg_ica || '—',
              frac:
                (product.codigo_frac || '')
                  .replace(/\r?\n|\r/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim() || '—',
              irac:
                (product.codigo_irac || '')
                  .replace(/\r?\n|\r/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim() || '—',
              hrac:
                (product.codigo_hrac || '')
                  .replace(/\r?\n|\r/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim() || '—',
              funcion: product.clase_producto || '—',
              carencia_dias: 0,
              residualidad_dias: 0,
              cat_toxicologica: product.categoria_toxicologica || '—',
              alerta
            };
          })
          .filter(Boolean);
      }
    } catch (err) {
      console.warn(
        '[GetProductDetailsUseCase] Error cargando ingredientes (se aplicará fallback determinista):',
        err.message
      );
    }

    if (ingredientes.length === 0) {
      const targetCat = (product.categoria_toxicologica || '').toUpperCase().trim();
      let alerta = null;
      if (targetCat === 'IA' || targetCat === 'IB' || targetCat === '1A' || targetCat === '1B') {
        const normalCat = targetCat.includes('A') ? 'IA' : 'IB';
        alerta = FALLBACK_ALERTAS[normalCat];
      }

      ingredientes = [
        {
          nombre: product.ingrediente_activo || '',
          concentracion: product.concentracion || '',
          grupo_quimico:
            (product.grupo_quimico || '')
              .replace(/\r?\n|\r/g, ' ')
              .replace(/\s+/g, ' ')
              .trim() || '—',
          registro_ica: product.reg_ica || '—',
          frac:
            (product.codigo_frac || '')
              .replace(/\r?\n|\r/g, ' ')
              .replace(/\s+/g, ' ')
              .trim() || '—',
          irac:
            (product.codigo_irac || '')
              .replace(/\r?\n|\r/g, ' ')
              .replace(/\s+/g, ' ')
              .trim() || '—',
          hrac:
            (product.codigo_hrac || '')
              .replace(/\r?\n|\r/g, ' ')
              .replace(/\s+/g, ' ')
              .trim() || '—',
          funcion: product.clase_producto || '—',
          carencia_dias: 0,
          residualidad_dias: 0,
          cat_toxicologica: product.categoria_toxicologica || '—',
          alerta
        }
      ];
    }

    return {
      id: product.id,
      nombre: product.nombre_producto,
      fabricante: '—',
      tipo: product.clase_producto,
      tipo_formulacion: product.tipo_formulacion,
      dosis_recomendada: 0,
      dosis_max: 0,
      unidad_dosis: 'L/ha',
      costo_estimado: 0,
      registro_ica: product.reg_ica || '—',
      ingredientes,
      carencia_dias: 0,
      residualidad_dias: 0
    };
  }
}

export default GetProductDetailsUseCase;
