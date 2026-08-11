import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { RequestSchema, PlanSchema } from '../../../../../packages/types/src/plan-schema.js';
import { fertilizationSystemPrompt } from '../prompts/fertilization-prompt.js';
import {
  buscarProductosTool,
  requerimientosCultivoTool,
  climaZonaTool
} from '../infrastructure/skycrop-tools.js';
import { supabaseAdmin } from '../../../shared/database/supabase.js';
import {
  ValidationError,
  ExternalApiError,
  RateLimitError,
  UnprocessableEntityError,
  ServiceUnavailableError
} from '../../../shared/errors/AppErrors.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import env from '../../../shared/config/env.js';

const inMemoryRateLimits = new Map();

export class SugerirPlanUseCase {
  async execute(requestBody, userId, requestId) {
    // 1. Parseo con Zod
    const parsed = RequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      throw new ValidationError('Input inválido', parsed.error.format());
    }
    const input = parsed.data;

    // 2. Rate limit y Cache (Idempotencia)
    if (requestId) {
      const { data: cached } = await supabaseAdmin
        .from('ai_usage_logs')
        .select('response_json, cost_usd, prompt_tokens, completion_tokens, duration_ms, model')
        .eq('request_id', requestId)
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 5 * 60000).toISOString())
        .limit(1)
        .maybeSingle();

      if (cached && cached.response_json) {
        return {
          plan: cached.response_json,
          metadata: {
            model: cached.model,
            steps: 0,
            promptTokens: cached.prompt_tokens,
            completionTokens: cached.completion_tokens,
            costUSD: cached.cost_usd,
            durationMs: cached.duration_ms,
            cached: true
          }
        };
      }
    }

    await this.checkRateLimit(userId);

    // 3. Modo Mock
    if (env.LLM === 'mock') {
      const mockResponse = {
        resumen: 'Plan de prueba generado rápidamente (Mock).',
        aplicaciones: [
          {
            fecha: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            productoId: 101,
            productoNombre: 'Urea (46-0-0)',
            dosis: 50,
            costo: 200000,
            justificacion: 'Simulación de mock',
            metodo: 'suelo'
          }
        ],
        presupuestoTotal: 200000
      };
      return {
        plan: mockResponse,
        metadata: {
          model: 'mock',
          steps: 0,
          promptTokens: 0,
          completionTokens: 0,
          costUSD: 0,
          durationMs: 10
        }
      };
    }

    // 4. Ejecución del LLM
    const startTime = Date.now();
    let llmResult;
    try {
      llmResult = await this.callLLM(input, env.LLM === 'deepseek' ? 'deepseek' : 'gemini');
    } catch (error) {
      console.warn(`Fallo primario con ${env.LLM}, intentando fallback...`, error);
      const fallbackModel = env.LLM === 'deepseek' ? 'gemini' : 'deepseek';
      try {
        llmResult = await this.callLLM(input, fallbackModel);
      } catch (fallbackError) {
        throw new ServiceUnavailableError('Ambos proveedores de IA (Gemini y DeepSeek) fallaron.');
      }
    }

    // 5. Extracción de JSON y Validación (PlanSchema)
    const jsonStr = this.extractJSON(llmResult.text);
    let planParsed = PlanSchema.safeParse(JSON.parse(jsonStr || '{}'));

    if (!planParsed.success) {
      // Reintento interno (1x)
      console.log('Reintento por JSON inválido...');
      const retryPrompt = `Tu respuesta anterior fue inválida según el esquema: ${planParsed.error.message}. Por favor, devuelve SOLO JSON válido sin texto extra y asegúrate de cumplir el formato.`;

      const retryResult = await this.callLLM(
        { ...input, extraInstructions: retryPrompt },
        llmResult.modelAlias
      );
      const retryJsonStr = this.extractJSON(retryResult.text);
      planParsed = PlanSchema.safeParse(JSON.parse(retryJsonStr || '{}'));

      if (!planParsed.success) {
        throw new ValidationError(
          'El LLM devolvió un formato inválido tras reintentar',
          planParsed.error.format()
        );
      }
      llmResult.usage.promptTokens += retryResult.usage.promptTokens;
      llmResult.usage.completionTokens += retryResult.usage.completionTokens;
    }

    const finalPlan = planParsed.data;

    // 6. Validación semántica del catálogo
    const invalidProducts = await this.validateProductsExist(finalPlan.aplicaciones);
    if (invalidProducts.length > 0) {
      throw new UnprocessableEntityError(
        `El LLM sugirió productos que no existen en el catálogo: ${invalidProducts.join(', ')}`
      );
    }

    const durationMs = Date.now() - startTime;
    const costUSD = this.calculateCost(llmResult.modelAlias, llmResult.usage);

    // 7. Guardado de Log (Asíncrono)
    supabaseAdmin
      .from('ai_usage_logs')
      .insert({
        request_id: requestId,
        user_id: userId,
        endpoint: '/api/v1/fertilizacion/sugerir-plan',
        model: llmResult.modelAlias,
        prompt_tokens: llmResult.usage.promptTokens,
        completion_tokens: llmResult.usage.completionTokens,
        cost_usd: costUSD,
        duration_ms: durationMs,
        response_json: finalPlan
      })
      .then(({ error }) => {
        if (error) console.error('Error logging AI usage:', error);
      });

    return {
      plan: finalPlan,
      metadata: {
        model: llmResult.modelAlias,
        steps: llmResult.steps,
        promptTokens: llmResult.usage.promptTokens,
        completionTokens: llmResult.usage.completionTokens,
        costUSD,
        durationMs
      }
    };
  }

  async checkRateLimit(userId) {
    if (
      env.UPSTASH_REDIS_REST_URL &&
      env.UPSTASH_REDIS_REST_TOKEN &&
      env.UPSTASH_REDIS_REST_URL.includes('upstash.io')
    ) {
      const redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN
      });
      const ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(5, '1 h')
      });
      const { success } = await ratelimit.limit(`sugerir_plan_${userId}`);
      if (!success) throw new RateLimitError();
    } else {
      // In-memory sliding window + Supabase fallback
      const now = Date.now();
      const userHits = (inMemoryRateLimits.get(userId) || []).filter((ts) => ts > now - 3600000);
      if (userHits.length >= 5) {
        throw new RateLimitError();
      }
      userHits.push(now);
      inMemoryRateLimits.set(userId, userHits);
    }
  }

  async callLLM(input, provider) {
    const presupuestoStr = input.presupuestoMax
      ? `Presupuesto máximo: $${input.presupuestoMax} COP.`
      : '';
    const extraStr = input.extraInstructions
      ? `\n\nINSTRUCCIONES EXTRA:\n${input.extraInstructions}`
      : '';
    const prompt = `Genera un plan de fertilización para el cultivo ${input.cultivo} (${input.areaHa} ha) en la región de ${input.region} (Lat: ${input.lat}, Lon: ${input.lon}). Etapa actual: ${input.etapa}. Fecha de inicio sugerida: ${input.fechaInicio}. ${presupuestoStr} ${extraStr}`;

    let model;
    if (provider === 'deepseek') {
      if (!env.DEEPSEEK_API_KEY) throw new Error('Missing DEEPSEEK_API_KEY');
      const openai = createOpenAI({
        apiKey: env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1'
      });
      model = openai('deepseek-chat');
    } else {
      if (!env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
      const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
      model = google('gemini-1.5-flash');
    }

    const result = await generateText({
      model,
      tools: {
        buscarProductos: buscarProductosTool,
        requerimientosCultivo: requerimientosCultivoTool,
        climaZona: climaZonaTool
      },
      maxSteps: 3,
      temperature: 0.3,
      system: fertilizationSystemPrompt,
      prompt
    });

    return {
      text: result.text,
      steps: result.steps?.length || 1,
      usage: result.usage,
      modelAlias: provider === 'deepseek' ? 'deepseek-chat' : 'gemini-2.5-flash'
    };
  }

  extractJSON(text) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    return match ? match[1] : text;
  }

  async validateProductsExist(aplicaciones) {
    const ids = aplicaciones.map((a) => a.productoId).filter(Boolean);
    if (ids.length === 0) return [];

    const { data } = await supabaseAdmin.from('productos').select('id').in('id', ids);
    const existingIds = new Set((data || []).map((d) => d.id.toString()));

    return ids.filter((id) => !existingIds.has(id.toString()));
  }

  calculateCost(modelAlias, usage) {
    if (modelAlias === 'deepseek-chat') {
      return (usage.promptTokens * 0.14) / 1000000 + (usage.completionTokens * 0.28) / 1000000;
    }
    // gemini-2.5-flash estimation
    return (usage.promptTokens * 0.075) / 1000000 + (usage.completionTokens * 0.3) / 1000000;
  }
}
