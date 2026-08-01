/**
 * ProtocolValidator
 * =================
 * Validador completo de protocolo antes de publicar.
 *
 * REGLAS DE VALIDACIÓN:
 *
 * BLOQUEO (errores críticos — impiden publicar):
 *   - El protocolo debe tener al menos 1 variable declarada
 *   - El protocolo debe tener al menos 1 indicador declarado
 *   - Cada indicador debe tener: clave, nombre, estrategia_tipo, configuración
 *   - Las fórmulas de indicadores tipo 'formula' deben ser sintácticamente válidas
 *   - Las referencias a variables en las fórmulas deben existir como variables del protocolo
 *   - No debe haber dependencias circulares entre indicadores
 *   - Las claves de variables e indicadores no deben repetirse
 *
 * ADVERTENCIAS (no bloquean, pero alertan al usuario):
 *   - Indicadores sin escalas configuradas (no se clasificará el riesgo)
 *   - Protocolo sin umbrales ni reglas de alerta
 *   - Protocolo sin recomendaciones
 *   - Variables sin tipo definido
 *   - Indicadores inactivos
 */

import { FormulaEngine }    from './FormulaEngine.js';
import { DependencyGraph }  from './DependencyGraph.js';

export class ProtocolValidator {

  /**
   * Valida el protocolo completo antes de publicar.
   *
   * @param {Object} protocolo — Definición completa del protocolo
   * @returns {{ valido: boolean, errores: string[], advertencias: string[] }}
   */
  static validate(protocolo) {
    const errores     = [];
    const advertencias = [];

    if (!protocolo || typeof protocolo !== 'object') {
      return { valido: false, errores: ['El protocolo no es un objeto válido'], advertencias: [] };
    }

    const variables  = protocolo.variables  || [];
    const indicadores = protocolo.indicadores || [];

    // ── REGLAS DE BLOQUEO ──────────────────────────────────────────────────

    // 1. Nombre del protocolo
    if (!protocolo.nombre?.trim()) {
      errores.push('El protocolo debe tener un nombre.');
    }

    // 2. Al menos 1 variable
    if (variables.length === 0) {
      errores.push('El protocolo debe tener al menos 1 variable declarada.');
    }

    // 3. Al menos 1 indicador activo
    const indicadoresActivos = indicadores.filter(i => i.activo !== false);
    if (indicadoresActivos.length === 0) {
      errores.push('El protocolo debe tener al menos 1 indicador activo.');
    }

    // 4. Claves únicas de variables
    const clavesVar = variables.map(v => v.clave).filter(Boolean);
    const clavesVarSet = new Set(clavesVar);
    if (clavesVar.length !== clavesVarSet.size) {
      const duplicadas = clavesVar.filter((c, i) => clavesVar.indexOf(c) !== i);
      errores.push(`Claves de variables duplicadas: ${[...new Set(duplicadas)].join(', ')}`);
    }

    // 5. Claves únicas de indicadores
    const clavesInd = indicadores.map(i => i.clave).filter(Boolean);
    const clavesIndSet = new Set(clavesInd);
    if (clavesInd.length !== clavesIndSet.size) {
      const duplicadas = clavesInd.filter((c, i) => clavesInd.indexOf(c) !== i);
      errores.push(`Claves de indicadores duplicadas: ${[...new Set(duplicadas)].join(', ')}`);
    }

    // 6. Cada indicador debe tener campos obligatorios
    for (const indicador of indicadores) {
      const id = indicador.nombre || indicador.clave || '[sin nombre]';

      if (!indicador.clave?.trim()) {
        errores.push(`Indicador "${id}": falta la clave (identificador único).`);
      }
      if (!indicador.nombre?.trim()) {
        errores.push(`Indicador "${indicador.clave || id}": falta el nombre descriptivo.`);
      }
      if (!indicador.estrategia_tipo) {
        errores.push(`Indicador "${id}": debe tener una estrategia de cálculo configurada.`);
        continue;
      }

      // 7. Validación específica de estrategia
      ProtocolValidator._validateStrategy(indicador, variables, indicadores, errores, advertencias);
    }

    // 8. Detectar dependencias circulares entre indicadores
    try {
      if (indicadoresActivos.length > 0 && variables.length > 0) {
        DependencyGraph.build(indicadoresActivos, clavesVar);
        // Si no lanza error, no hay ciclos
      }
    } catch (err) {
      errores.push(`Dependencias circulares detectadas: ${err.message}`);
    }

    // ── ADVERTENCIAS ───────────────────────────────────────────────────────

    // Indicadores sin escalas
    const indSinEscalas = indicadoresActivos.filter(i => !i.escalas?.length);
    if (indSinEscalas.length > 0) {
      advertencias.push(
        `Los siguientes indicadores no tienen escalas de clasificación: ${indSinEscalas.map(i => i.nombre || i.clave).join(', ')}. ` +
        'El nivel de riesgo no podrá determinarse para ellos.'
      );
    }

    // Sin umbrales ni reglas
    if (!(protocolo.umbrales?.length) && !(protocolo.reglas?.length)) {
      advertencias.push('El protocolo no tiene umbrales ni reglas de alerta configuradas. No se generarán alertas automáticas.');
    }

    // Sin recomendaciones
    if (!(protocolo.recomendaciones?.length)) {
      advertencias.push('El protocolo no tiene reglas de recomendación configuradas. Las alertas no incluirán acciones sugeridas.');
    }

    // Variables sin tipo
    const varSinTipo = variables.filter(v => !v.tipo?.trim());
    if (varSinTipo.length > 0) {
      advertencias.push(`Variables sin tipo definido: ${varSinTipo.map(v => v.clave || v.etiqueta).join(', ')}`);
    }

    // Indicadores inactivos
    const inactivos = indicadores.filter(i => i.activo === false);
    if (inactivos.length > 0) {
      advertencias.push(`${inactivos.length} indicador(es) están marcados como inactivos y no se calcularán.`);
    }

    return {
      valido:       errores.length === 0,
      errores,
      advertencias,
    };
  }

  // ─── VALIDACIÓN DE ESTRATEGIA ────────────────────────────────────────────

  /**
   * Valida la configuración de la estrategia de un indicador.
   */
  static _validateStrategy(indicador, variables, indicadores, errores, advertencias) {
    const id     = indicador.nombre || indicador.clave;
    const tipo   = indicador.estrategia_tipo;
    const config = indicador.configuracion || {};
    const clavesVar = new Set(variables.map(v => v.clave));
    const clavesInd = new Set(indicadores.map(i => i.clave));

    switch (tipo) {
      case 'porcentaje': {
        if (!config.numerador) {
          errores.push(`Indicador "${id}" (porcentaje): debe especificar el numerador.`);
        } else if (!clavesVar.has(config.numerador) && !clavesInd.has(config.numerador)) {
          errores.push(`Indicador "${id}" (porcentaje): el numerador "${config.numerador}" no existe como variable ni indicador del protocolo.`);
        }
        if (!config.denominador) {
          errores.push(`Indicador "${id}" (porcentaje): debe especificar el denominador.`);
        } else if (!clavesVar.has(config.denominador) && !clavesInd.has(config.denominador)) {
          errores.push(`Indicador "${id}" (porcentaje): el denominador "${config.denominador}" no existe como variable ni indicador del protocolo.`);
        }
        if (config.numerador && config.denominador && config.numerador === config.denominador) {
          errores.push(`Indicador "${id}" (porcentaje): el numerador y denominador no pueden ser la misma variable.`);
        }
        break;
      }

      case 'absoluto': {
        const varKey = config.variable_clave || config.variable;
        if (!varKey) {
          errores.push(`Indicador "${id}" (absoluto): debe especificar la variable fuente.`);
        } else if (!clavesVar.has(varKey)) {
          errores.push(`Indicador "${id}" (absoluto): la variable "${varKey}" no está declarada en el protocolo.`);
        }
        break;
      }

      case 'promedio': {
        const vars = config.variables || [];
        if (vars.length === 0) {
          errores.push(`Indicador "${id}" (promedio): debe especificar al menos una variable.`);
        } else {
          for (const v of vars) {
            if (!clavesVar.has(v)) {
              errores.push(`Indicador "${id}" (promedio): la variable "${v}" no está declarada en el protocolo.`);
            }
          }
        }
        break;
      }

      case 'formula': {
        const expresion = config.expresion || config.formula || '';
        if (!expresion.trim()) {
          errores.push(`Indicador "${id}" (fórmula): la expresión matemática está vacía.`);
        } else {
          // Validar sintaxis de la fórmula
          const knownTokens = [
            ...Array.from(clavesVar).map(k => k.toUpperCase()),
            ...Array.from(clavesInd).map(k => k.toUpperCase()),
            ...Object.keys(config.variables || {}).map(k => k.toUpperCase()),
          ];
          const { valido: sintaxisOk, errores: sinErrList } = FormulaEngine.validate(expresion, knownTokens);
          if (!sintaxisOk) {
            errores.push(...sinErrList.map(e => `Indicador "${id}" (fórmula): ${e}`));
          }
        }
        break;
      }

      case 'indice_ponderado': {
        const pesos = config.pesos || {};
        if (Object.keys(pesos).length === 0) {
          errores.push(`Indicador "${id}" (índice ponderado): debe definir al menos un par variable-peso.`);
        }
        break;
      }

      default: {
        advertencias.push(`Indicador "${id}": estrategia "${tipo}" no es reconocida por el validador. Se aceptará pero no podrá validarse.`);
      }
    }
  }
}
