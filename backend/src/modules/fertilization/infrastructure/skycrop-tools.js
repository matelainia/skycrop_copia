import { tool } from 'ai';
import { z } from 'zod';
import { supabaseAdmin } from '../../../shared/database/supabase.js';

const TOOL_ROW_LIMIT = 8;

export const buscarProductosTool = tool({
  description: 'Busca productos en el catálogo de SkyCrop para fertilización',
  parameters: z.object({
    categoria: z
      .string()
      .optional()
      .describe(
        'Filtra por clase de producto (ej. fertilizante, fertilizante_foliar, enmienda, organico)'
      ),
    nutriente: z
      .string()
      .optional()
      .describe('Busca un nutriente específico en el nombre o descripción')
  }),
  execute: async ({ categoria, nutriente }) => {
    let query = supabaseAdmin
      .from('productos')
      .select('id, nombre_producto, clase_producto')
      .limit(TOOL_ROW_LIMIT);

    if (categoria) {
      query = query.eq('clase_producto', categoria);
    }

    if (nutriente) {
      query = query.ilike('nombre_producto', `%${nutriente}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error en buscarProductosTool:', error);
      return [];
    }
    return data;
  }
});

export const requerimientosCultivoTool = tool({
  description:
    'Obtiene los requerimientos nutricionales base (kg/ha de N, P, K) para un cultivo y etapa fenológica',
  parameters: z.object({
    cultivo: z.string(),
    etapa: z.string().optional()
  }),
  execute: async ({ cultivo, etapa }) => {
    let query = supabaseAdmin
      .from('requerimientos')
      .select('cultivo, etapa, nutrientes_kg_ha')
      .eq('cultivo', cultivo);
    if (etapa) {
      query = query.eq('etapa', etapa);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error en requerimientosCultivoTool:', error);
      return [];
    }
    return data;
  }
});

export const climaZonaTool = tool({
  description:
    'Obtiene el pronóstico de lluvias de los próximos días para una ubicación geográfica',
  parameters: z.object({
    lat: z.number().default(3.54),
    lon: z.number().default(-76.52)
  }),
  execute: async ({ lat, lon }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`,
        {
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('API Clima respondió con error');

      const data = await response.json();
      const daily = data.daily || {};
      const dates = daily.time || [];
      const precip = daily.precipitation_sum || [];

      const res = dates.map((date, i) => ({
        fecha: date,
        lluvia_mm: precip[i] || 0,
        alerta_lluvia_fuerte: precip[i] > 10
      }));

      return {
        weatherAvailable: true,
        forecast: res
      };
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Error en climaZonaTool (o timeout):', err.message);
      return {
        weatherAvailable: false,
        warnings: ['API clima no disponible, omitiendo restricción de lluvia'],
        forecast: []
      };
    }
  }
});
