import { ProductRepositoryPort } from '../../../domain/ports/ProductRepositoryPort.js';
import { supabaseAdmin } from '../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../shared/errors/AppErrors.js';

export class SupabaseProductRepository extends ProductRepositoryPort {
  async searchProducts(query, limit = 15) {
    try {
      let qBuilder = supabaseAdmin
        .from('productos')
        .select(
          `
          id,
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

      if (query.trim().length > 0) {
        qBuilder = qBuilder.or(
          `nombre_producto.ilike.%${query}%,ingrediente_activo.ilike.%${query}%`
        );
      }

      const { data, error } = await qBuilder;
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error realizando búsqueda de productos', err);
    }
  }

  async getProductById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('productos')
        .select(
          `
          id,
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
