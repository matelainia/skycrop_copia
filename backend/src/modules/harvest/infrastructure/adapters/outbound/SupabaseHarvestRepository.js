import { HarvestRepositoryPort } from '../../../domain/ports/HarvestRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError, NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseHarvestRepository extends HarvestRepositoryPort {
  async createHarvest(companyId, userId, data) {
    try {
      // H2/047: overload con empresa explicita (service_role no tiene JWT de usuario;
      // la RPC INVOKER original deriva current_company() y tras 043 devuelve NULL).
      const payload = {
        p_company_id: companyId,
        p_predio_id: data.predio_id || null,
        p_lote_agricola_id: data.lote_agricola_id || null,
        p_cultivo: data.cultivo,
        p_variedad: data.variedad || null,
        p_area_cosechada: data.area_cosechada || null,
        p_cantidad: data.cantidad,
        p_unidad: data.unidad || 'kg',
        p_numero_plantas: data.numero_plantas || null,
        p_responsable: data.responsable || null,
        p_observaciones: data.observaciones || null,
        p_lat: data.latitud || null,
        p_lng: data.longitud || null,
        p_precision_gps: data.precision_gps || null,
        p_user_id: userId || null
      };
      let result = null;
      let error = null;
      ({ data: result, error } = await supabaseAdmin.rpc('registrar_cosecha_empresa', payload));
      if (error && error.code === '42883') {
        // DB sin 047: RPC INVOKER original (solo funciona con JWT; con service_role
        // tras 043 levanta 'Empresa no identificada' y se cae al insert directo).
        const legacy = { ...payload };
        delete legacy.p_company_id;
        delete legacy.p_user_id;
        ({ data: result, error } = await supabaseAdmin.rpc('registrar_cosecha', legacy));
      }
      // Fallback si RPC no existe aún (dev local sin migración): intentar insert directo
      if (error) {
        const missing = error.code === '42883' || error.message?.includes('registrar_cosecha');
        const noTenant = error.message?.includes('Empresa no identificada');
        if (missing || noTenant) {
          const { data: inserted, error: insErr } = await supabaseAdmin
            .from('cosechas')
            .insert([
              {
                company_id: companyId,
                predio_id: data.predio_id || null,
                lote_id: data.lote_agricola_id || null,
                crop: data.cultivo,
                cultivo_variedad: data.variedad || data.cultivo,
                area_cosechada: data.area_cosechada || null,
                cantidad_cosechada: data.cantidad,
                weight: data.cantidad,
                unidad: data.unidad || 'kg',
                numero_plantas: data.numero_plantas || null,
                responsable_nombre: data.responsable || null,
                observaciones: data.observaciones || null,
                latitud: data.latitud || null,
                longitud: data.longitud || null,
                precision_gps: data.precision_gps || null,
                estado: 'REGISTRADA',
                lote: 'SIN-LOTE',
                grade: 'Grado A',
                storage: 'Sin asignar',
                date: new Date().toISOString().slice(0, 10)
              }
            ])
            .select()
            .single();
          if (insErr) throw insErr;
          return inserted;
        }
        throw error;
      }
      // result es {success, cosecha_id, codigo}
      if (result?.cosecha_id) {
        const { data: full } = await supabaseAdmin
          .from('cosechas')
          .select('*')
          .eq('id', result.cosecha_id)
          .single();
        return full || result;
      }
      return result;
    } catch (err) {
      throw new DatabaseError('Error creando cosecha', err);
    }
  }

  async listHarvests(companyId, filters) {
    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let q = supabaseAdmin
        .from('cosechas')
        .select(
          'id, codigo, predio_id, lote_id, crop, cultivo_variedad, area_cosechada, cantidad_cosechada, weight, unidad, rendimiento_kg_ha, estado, responsable_nombre, fecha_cosecha, date, created_at, lote, grade, predios(nombre), lotes(codigo_interno, nombre)',
          { count: 'exact' }
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('fecha_cosecha', { ascending: false })
        .range(from, to);

      if (filters.predio_id) q = q.eq('predio_id', filters.predio_id);
      if (filters.lote_id) q = q.eq('lote_id', filters.lote_id);
      if (filters.cultivo)
        q = q.or(`crop.ilike.%${filters.cultivo}%,cultivo_variedad.ilike.%${filters.cultivo}%`);
      if (filters.estado) q = q.eq('estado', filters.estado);
      if (filters.search) {
        const safe = filters.search.replace(/[(),*"\\]/g, '').trim();
        if (safe)
          q = q.or(`codigo.ilike.%${safe}%,crop.ilike.%${safe}%,cultivo_variedad.ilike.%${safe}%`);
      }
      // periodo filtering
      if (filters.periodo && filters.periodo !== 'todos') {
        let start;
        const now = new Date();
        if (filters.periodo === 'este_anio') start = new Date(now.getFullYear(), 0, 1);
        else if (filters.periodo === 'ultimos_6_meses') {
          start = new Date(now);
          start.setMonth(start.getMonth() - 6);
        } else if (filters.periodo === 'este_mes')
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        if (start) q = q.gte('fecha_cosecha', start.toISOString());
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (err) {
      throw new DatabaseError('Error listando cosechas', err);
    }
  }

  async getHarvestById(companyId, harvestId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cosechas')
        .select('*, predios(id,nombre), lotes(id,codigo_interno,nombre,cultivo)')
        .eq('id', harvestId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotFoundError('Cosecha no encontrada');
      return data;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error obteniendo cosecha', err);
    }
  }

  async getDashboard(companyId, filters) {
    try {
      const { data, error } = await supabaseAdmin.rpc('dashboard_cosecha_postcosecha', {
        p_predio_id: filters?.predio_id || null,
        p_lote_id: filters?.lote_id || null,
        p_periodo: filters?.periodo || 'este_anio'
      });
      if (error) {
        // Fallback: cálculo manual si RPC no existe
        if (error.code === '42883') {
          const { data: cosechas } = await supabaseAdmin
            .from('cosechas')
            .select('cantidad_cosechada,weight,area_cosechada')
            .eq('company_id', companyId)
            .is('deleted_at', null);
          const acum = (cosechas || []).reduce(
            (a, c) => a + (c.cantidad_cosechada || c.weight || 0),
            0
          );
          const area = (cosechas || []).reduce((a, c) => a + (c.area_cosechada || 0), 0);
          const rend = area > 0 ? acum / area : 0;
          const { data: prods } = await supabaseAdmin
            .from('lotes_producto')
            .select('peso_actual,bodega_id')
            .eq('company_id', companyId)
            .in('estado', ['ALMACENADO', 'TERMINADO', 'RESERVADO']);
          const almacenado = (prods || []).reduce((a, p) => a + (p.peso_actual || 0), 0);
          const bodegas = new Set((prods || []).map((p) => p.bodega_id).filter(Boolean)).size;
          return {
            cosecha_acumulada_kg: acum,
            area_cosechada_ha: area,
            rendimiento_kg_ha: Math.round(rend * 100) / 100,
            producto_almacenado_kg: almacenado,
            bodegas_con_stock: bodegas,
            cosechas_registradas: cosechas?.length || 0
          };
        }
        throw error;
      }
      return data;
    } catch (err) {
      throw new DatabaseError('Error obteniendo dashboard', err);
    }
  }

  async getHistoricoMensual(companyId, year) {
    try {
      const { data, error } = await supabaseAdmin.rpc('cosecha_historica_mensual', {
        p_year: year
      });
      if (error) {
        if (error.code === '42883') {
          // fallback: agregar manualmente
          const { data: cosechas } = await supabaseAdmin
            .from('cosechas')
            .select('fecha_cosecha,date,cantidad_cosechada,weight')
            .eq('company_id', companyId)
            .is('deleted_at', null);
          const months = Array.from({ length: 12 }, (_, i) => ({
            mes: i + 1,
            mes_nombre: [
              'Ene',
              'Feb',
              'Mar',
              'Abr',
              'May',
              'Jun',
              'Jul',
              'Ago',
              'Sep',
              'Oct',
              'Nov',
              'Dic'
            ][i],
            total_kg: 0,
            total_ha: 0,
            cosechas: 0
          }));
          (cosechas || []).forEach((c) => {
            const d = c.fecha_cosecha || c.date;
            if (!d) return;
            const dt = new Date(d);
            if (dt.getFullYear() !== year) return;
            const m = dt.getMonth();
            months[m].total_kg += c.cantidad_cosechada || c.weight || 0;
            months[m].cosechas += 1;
          });
          return months;
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error histórico mensual', err);
    }
  }

  async getPostHarvestStatus(companyId, filters) {
    try {
      // Calcular estado postcosecha basado en lotes_producto y procesos
      const { data: lotesProd } = await supabaseAdmin
        .from('lotes_producto')
        .select('estado,peso_actual')
        .eq('company_id', companyId);
      const { data: cosechas } = await supabaseAdmin
        .from('cosechas')
        .select('cantidad_cosechada,weight')
        .eq('company_id', companyId)
        .is('deleted_at', null);
      const totalCosechado = (cosechas || []).reduce(
        (a, c) => a + (c.cantidad_cosechada || c.weight || 0),
        0
      );
      // Simular estados: si no hay lotes_producto, todo sigue cosechado
      if (!lotesProd || lotesProd.length === 0) {
        return [
          { estado: 'Cosechado', kg: totalCosechado, pct: 100 },
          { estado: 'En Beneficio', kg: 0, pct: 0 },
          { estado: 'En Secado', kg: 0, pct: 0 },
          { estado: 'Almacenado', kg: 0, pct: 0 },
          { estado: 'Vendido', kg: 0, pct: 0 }
        ];
      }
      const byEstado = {};
      lotesProd.forEach((lp) => {
        byEstado[lp.estado] = (byEstado[lp.estado] || 0) + (lp.peso_actual || 0);
      });
      const almacenado =
        (byEstado['ALMACENADO'] || 0) + (byEstado['TERMINADO'] || 0) + (byEstado['RESERVADO'] || 0);
      const vendido = (byEstado['VENDIDO'] || 0) + (byEstado['DESPACHADO'] || 0);
      const enProceso = byEstado['PROCESANDO'] || 0;
      // Distribuir enBeneficio/Secado proporcional si hay procesos
      const { data: procesos } = await supabaseAdmin
        .from('procesos_postcosecha')
        .select('tipo,peso_inicial,peso_final,estado')
        .eq('company_id', companyId);
      let enBeneficio = 0,
        enSecado = 0;
      if (procesos && procesos.length) {
        procesos.forEach((p) => {
          if (p.tipo === 'FERMENTACION') enBeneficio += p.peso_inicial || 0;
          if (p.tipo === 'SECADO') enSecado += p.peso_inicial || 0;
        });
        if (enBeneficio === 0 && enSecado === 0) {
          enBeneficio = enProceso * 0.5;
          enSecado = enProceso * 0.5;
        }
      } else {
        enBeneficio = enProceso * 0.5;
        enSecado = enProceso * 0.5;
      }
      const pct = (kg) => (totalCosechado > 0 ? Math.round((kg / totalCosechado) * 1000) / 10 : 0);
      return [
        { estado: 'Cosechado', kg: totalCosechado, pct: 100 },
        { estado: 'En Beneficio', kg: enBeneficio, pct: pct(enBeneficio) },
        { estado: 'En Secado', kg: enSecado, pct: pct(enSecado) },
        { estado: 'Almacenado', kg: almacenado, pct: pct(almacenado) },
        { estado: 'Vendido', kg: vendido, pct: pct(vendido) }
      ];
    } catch (err) {
      throw new DatabaseError('Error estado postcosecha', err);
    }
  }

  async listAlertas(companyId, limit = 5) {
    try {
      const { data, error } = await supabaseAdmin
        .from('alertas')
        .select('id,tipo,mensaje,leida,created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new DatabaseError('Error alertas', err);
    }
  }

  async trazabilidadPorCodigo(companyId, codigo) {
    try {
      // H2/047: primero overload con empresa explicita (tenant verificado en SQL).
      let { data, error } = await supabaseAdmin.rpc('trazabilidad_por_codigo_empresa', {
        p_company_id: companyId,
        p_codigo: codigo
      });
      if (error && error.code === '42883') {
        ({ data, error } = await supabaseAdmin.rpc('trazabilidad_por_codigo', {
          p_codigo: codigo
        }));
      }
      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError('Error trazabilidad', err);
    }
  }

  async updateHarvest(companyId, harvestId, data) {
    try {
      const { data: updated, error } = await supabaseAdmin
        .from('cosechas')
        .update({
          cultivo_variedad: data.variedad || data.cultivo,
          crop: data.cultivo,
          area_cosechada: data.area_cosechada,
          cantidad_cosechada: data.cantidad,
          weight: data.cantidad,
          responsable_nombre: data.responsable,
          observaciones: data.observaciones,
          estado: data.estado,
          updated_at: new Date().toISOString()
        })
        .eq('id', harvestId)
        .eq('company_id', companyId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } catch (err) {
      throw new DatabaseError('Error actualizando cosecha', err);
    }
  }

  async deleteHarvest(companyId, harvestId) {
    try {
      // Soft delete conforme criterio (no hard delete cosechas críticas)
      const { error } = await supabaseAdmin
        .from('cosechas')
        .update({ deleted_at: new Date().toISOString(), estado: 'ANULADA' })
        .eq('id', harvestId)
        .eq('company_id', companyId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      throw new DatabaseError('Error anulando cosecha', err);
    }
  }
}
export default SupabaseHarvestRepository;
