import { StrategyRegistry } from '../../../agronomy/domain/services/strategies/StrategyRegistry.js';

/**
 * EvaluationEngine — Motor principal de evaluación agronómica.
 *
 * Responsabilidades:
 *  1. Recibir los datos de campo capturados durante una evaluación.
 *  2. Resolver y ejecutar la estrategia de cálculo de cada indicador del protocolo.
 *  3. Clasificar el valor del indicador contra las escalas configuradas,
 *     priorizando escalas contextuales si el contexto activo coincide.
 *  4. Evaluar las reglas del protocolo sobre los indicadores calculados.
 *  5. Retornar un resultado estructurado listo para persistir y mostrar.
 *
 * Principio de diseño:
 *   El engine es agnóstico al tipo de estrategia. Delega el cálculo al
 *   StrategyRegistry, que retorna la estrategia correcta por tipo.
 *   Para añadir metodologías nuevas basta con registrar una nueva estrategia.
 *
 * Uso típico:
 *   const engine = new EvaluationEngine();
 *   const resultado = engine.run(protocolo, datosCaptura, contexto);
 *   // resultado.indicadores → array con valor, escala y advertencias de cada indicador
 *   // resultado.reglasActivadas → reglas disparadas
 *   // resultado.resumenRiesgo → nivel de riesgo global del lote
 */
export class EvaluationEngine {
  /**
   * Ejecuta el ciclo completo de evaluación para un protocolo.
   *
   * @param {Object} protocolo   - Objeto de dominio del protocolo (con indicadores y reglas).
   * @param {Object} datosCaptura - Datos de campo: { clave_variable: valor }.
   * @param {Object} [contexto]  - Contexto operativo opcional: { estado_fenologico, variedad, zona, temporada }.
   * @returns {EvaluationResult}
   */
  run(protocolo, datosCaptura, contexto = {}) {
    const indicadores = protocolo.indicadores || [];
    const reglas = protocolo.reglas || [];

    // ── Paso 1: Calcular indicadores ───────────────────────────────────────
    const resultadosIndicadores = indicadores
      .filter((ind) => ind.activo !== false)
      .map((ind) => this._procesarIndicador(ind, datosCaptura));

    // ── Paso 2: Clasificar en escalas ─────────────────────────────────────
    const indicadoresClasificados = resultadosIndicadores.map((res) => {
      const indicador = indicadores.find((i) => i.clave === res.clave);
      const escalas = indicador?.escalas || [];
      const clasificacion = this._clasificarEnEscala(res.valor, escalas, contexto);
      return { ...res, clasificacion };
    });

    // ── Paso 3: Evaluar reglas sobre indicadores ───────────────────────────
    const reglasActivadas = this._evaluarReglas(reglas, indicadoresClasificados);

    // ── Paso 4: Determinar nivel de riesgo global ──────────────────────────
    const resumenRiesgo = this._calcularRiesgoGlobal(indicadoresClasificados, reglasActivadas);

    return {
      indicadores: indicadoresClasificados,
      reglasActivadas,
      resumenRiesgo,
      contexto,
      timestamp: new Date().toISOString(),
      datosCaptura
    };
  }

  /**
   * Calcula el valor de un indicador a partir de los datos de campo.
   *
   * @param {Object} indicador   - Definición del indicador del protocolo.
   * @param {Object} datosCaptura
   * @returns {IndicadorResult}
   */
  _procesarIndicador(indicador, datosCaptura) {
    const strategy = StrategyRegistry.get(indicador.estrategia_tipo || 'absoluto');
    const options = { decimales: indicador.decimales ?? 2 };

    const resultado = strategy.calculate(datosCaptura, indicador.configuracion || {}, options);

    return {
      clave: indicador.clave,
      nombre: indicador.nombre,
      unidad: resultado.unidad || indicador.unidad || '',
      valor: resultado.valor,
      valido: resultado.valido,
      error: resultado.error || null,
      advertencia: resultado.advertencia || null,
      estrategia: indicador.estrategia_tipo
    };
  }

  /**
   * Clasifica un valor de indicador en la escala correspondiente.
   * Prioriza escalas contextuales sobre la escala general.
   *
   * @param {number|null} valor
   * @param {Array} escalas   - Escalas del indicador ({ nivel, min_val, max_val, color, contexto }).
   * @param {Object} contexto - Contexto activo de la evaluación.
   * @returns {EscalaResult|null}
   */
  _clasificarEnEscala(valor, escalas, contexto) {
    if (valor === null || !Array.isArray(escalas) || escalas.length === 0) return null;

    // Filtrar escalas contextuales que coinciden, y escalas generales como fallback
    const contextuales = escalas.filter(
      (e) => e.contexto && this._contextoCoincide(e.contexto, contexto)
    );
    const generales = escalas.filter((e) => !e.contexto);

    // Priorizar escalas contextuales si existen para el contexto actual
    const candidatas = contextuales.length > 0 ? contextuales : generales;

    for (const escala of candidatas) {
      const min = escala.min_val ?? escala.min ?? null;
      const max = escala.max_val ?? escala.max ?? null;

      const cumpleMin = min === null || valor >= Number(min);
      const cumpleMax = max === null || valor <= Number(max);

      if (cumpleMin && cumpleMax) {
        return {
          nivel: escala.nivel,
          color: escala.color,
          bg_color: escala.bg_color,
          min: min,
          max: max,
          contextual: contextuales.length > 0
        };
      }
    }

    // Si el valor supera todos los rangos, retornar el de mayor nivel (último en orden)
    const ultimo = candidatas[candidatas.length - 1];
    if (ultimo) {
      return {
        nivel: ultimo.nivel,
        color: ultimo.color,
        bg_color: ultimo.bg_color,
        min: null,
        max: null,
        contextual: false,
        fuera_de_rango: true
      };
    }

    return null;
  }

  /**
   * Verifica si el contexto de una escala coincide con el contexto activo de la evaluación.
   * Se usan comparaciones parciales: solo se verifican las claves presentes en la escala.
   *
   * @param {Object} contextoEscala  - Contexto definido en la escala.
   * @param {Object} contextoActivo  - Contexto de la evaluación actual.
   * @returns {boolean}
   */
  _contextoCoincide(contextoEscala, contextoActivo) {
    if (!contextoEscala || !contextoActivo) return false;
    return Object.entries(contextoEscala).every(([clave, valor]) => {
      return (
        contextoActivo[clave] &&
        String(contextoActivo[clave]).toLowerCase() === String(valor).toLowerCase()
      );
    });
  }

  /**
   * Evalúa las reglas del protocolo contra los indicadores calculados.
   * Las reglas operan sobre el valor calculado del indicador (no sobre datos crudos).
   *
   * @param {Array} reglas
   * @param {Array} indicadoresClasificados
   * @returns {Array<ReglaActivada>}
   */
  _evaluarReglas(reglas, indicadoresClasificados) {
    const mapaIndicadores = new Map(indicadoresClasificados.map((i) => [i.clave, i]));

    return (reglas || [])
      .filter((regla) => {
        const indicador =
          mapaIndicadores.get(regla.variable_clave) ||
          mapaIndicadores.get(`ind_${regla.variable_clave}`); // soporte legado
        if (!indicador || indicador.valor === null) return false;

        return this._evaluarCondicion(indicador.valor, regla.operador, Number(regla.valor));
      })
      .map((regla) => ({
        regla_id: regla.id || null,
        variable_clave: regla.variable_clave,
        operador: regla.operador,
        valor_umbral: regla.valor,
        accion: regla.accion,
        mensaje: regla.mensaje || null
      }));
  }

  /**
   * Evalúa una condición matemática simple.
   * @param {number} valorIndicador
   * @param {string} operador
   * @param {number} valorUmbral
   * @returns {boolean}
   */
  _evaluarCondicion(valorIndicador, operador, valorUmbral) {
    switch (operador) {
      case '>':
        return valorIndicador > valorUmbral;
      case '<':
        return valorIndicador < valorUmbral;
      case '>=':
        return valorIndicador >= valorUmbral;
      case '<=':
        return valorIndicador <= valorUmbral;
      case '=':
      case '==':
        return valorIndicador === valorUmbral;
      case '!=':
        return valorIndicador !== valorUmbral;
      default:
        return false;
    }
  }

  /**
   * Calcula el nivel de riesgo global del lote basándose en la clasificación
   * de todos los indicadores de la evaluación.
   *
   * @param {Array} indicadoresClasificados
   * @param {Array} reglasActivadas
   * @returns {{ nivel: string, color: string, numIndicadoresRiesgo: number }}
   */
  _calcularRiesgoGlobal(indicadoresClasificados, reglasActivadas) {
    const jerarquiaNiveles = { Crítico: 4, Alto: 3, Medio: 2, Bajo: 1 };
    let nivelMaximo = 0;
    let nivelLabel = 'Sin datos';
    let color = '#6b7280';

    indicadoresClasificados.forEach((ind) => {
      const jerarquia = jerarquiaNiveles[ind.clasificacion?.nivel] || 0;
      if (jerarquia > nivelMaximo) {
        nivelMaximo = jerarquia;
        nivelLabel = ind.clasificacion.nivel;
        color = ind.clasificacion.color || color;
      }
    });

    return {
      nivel: nivelLabel,
      color,
      numIndicadoresRiesgo: indicadoresClasificados.filter(
        (i) => (jerarquiaNiveles[i.clasificacion?.nivel] || 0) >= 3
      ).length,
      numReglasActivadas: reglasActivadas.length
    };
  }
}
