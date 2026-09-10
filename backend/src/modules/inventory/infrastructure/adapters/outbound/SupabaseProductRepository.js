import { ProductRepositoryPort } from '../../../domain/ports/ProductRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseProductRepository extends ProductRepositoryPort {
  async searchProducts(query, limit = 15, companyId = null) {
    try {
      let qBuilder = supabaseAdmin
        .from('productos')
        .select(
          `
          id,
          company_id,
          nombre_producto,
          reg_ica,
          ingrediente_activo,
          concentracion,
          categoria_toxicologica,
          clase_producto,
          tipo_formulacion
        `
        )
        .limit(limit)
        .order('nombre_producto', { ascending: true });

      // H2: catalogo global (company_id NULL) + propios; nunca ajenos.
      if (companyId) {
        qBuilder = qBuilder.or(`company_id.is.null,company_id.eq.${companyId}`);
      } else {
        qBuilder = qBuilder.is('company_id', null);
      }

      if (query.trim().length > 0) {
        // Sanitización: se eliminan caracteres con significado en la gramática de
        // filtros PostgREST (comas, paréntesis, comillas, operadores) para evitar
        // inyección de condiciones en la cláusula .or().
        const safeQuery = query.replace(/[(),*"\\]/g, '').trim();
        if (safeQuery.length > 0) {
          qBuilder = qBuilder.or(
            `nombre_producto.ilike.%${safeQuery}%,ingrediente_activo.ilike.%${safeQuery}%`
          );
        }
      }

      const { data, error } = await qBuilder;
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error realizando búsqueda de productos', err);
    }
  }

  async getProductById(id, companyId = null) {
    try {
      const { data, error } = await supabaseAdmin
        .from('productos')
        .select(
          `
          id,
          company_id,
          nombre_producto,
          reg_ica,
          ingrediente_activo,
          concentracion,
          categoria_toxicologica,
          clase_producto,
          tipo_formulacion,
          codigo_frac,
          codigo_irac,
          codigo_hrac,
          grupo_quimico
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      // H2: producto de otra empresa => inexistente para este tenant.
      if (data && data.company_id && companyId && data.company_id !== companyId) return null;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error consultando producto por ID: ${id}`, err);
    }
  }

  async getProductIngredients(productId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('producto_ingrediente')
        .select(
          `
          ingrediente:ingredientes (
            id,
            nombre,
            propiedades (
              categoria_toxicologica,
              titulo_alerta,
              mensaje_alerta,
              recomendaciones
            )
          )
        `
        )
        .eq('producto_id', productId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError(
        `Error al consultar ingredientes vinculados del producto: ${productId}`,
        err
      );
    }
  }
}

export default SupabaseProductRepository;
