/**
 * ProtocolValidatorService
 * ========================
 * Validador del lado del BACKEND para protocolos antes de publicar.
 *
 * Nota: Es el espejo del ProtocolValidator del frontend, pero independiente
 * para no acoplar el backend a los módulos del frontend.
 * Validaciones idénticas garantizan coherencia en ambas capas.
 */

export class ProtocolValidatorService {
  /**
   * Valida el protocolo ensamblado antes de publicar.
   *
   * @param {Object} protocolo — Objeto de dominio ensamblado (cabecera + entidades)
   * @returns {{ valido: boolean, errores: string[], advertencias: string[] }}
   */
  static validate(protocolo) {
    const errores = [];
    const advertencias = [];

    if (!protocolo || typeof protocolo !== 'object') {
      return { valido: false, errores: ['El protocolo no es un objeto válido'], advertencias: [] };
    }

    const variables = protocolo.variables || [];
    const indicadores = protocolo.indicadores || [];

    // ── ERRORES CRÍTICOS (bloquean publicación) ────────────────────────────

    if (!protocolo.nombre?.trim()) {
      errores.push('El protocolo debe tener un nombre.');
    }

    if (variables.length === 0) {
      errores.push('El protocolo debe tener al menos 1 variable declarada.');
    }

    const indicadoresActivos = indicadores.filter((i) => i.activo !== false);
    if (indicadoresActivos.length === 0) {
      errores.push('El protocolo debe tener al menos 1 indicador activo.');
    }

    // Claves de variables únicas
    const clavesVar = variables.map((v) => v.clave).filter(Boolean);
    const dupVar = clavesVar.filter((c, i) => clavesVar.indexOf(c) !== i);
    if (dupVar.length > 0) {
      errores.push(`Claves de variables duplicadas: ${[...new Set(dupVar)].join(', ')}`);
    }

    // Claves de indicadores únicas
    const clavesInd = indicadores.map((i) => i.clave).filter(Boolean);
    const dupInd = clavesInd.filter((c, i) => clavesInd.indexOf(c) !== i);
    if (dupInd.length > 0) {
      errores.push(`Claves de indicadores duplicadas: ${[...new Set(dupInd)].join(', ')}`);
    }

    // Validar cada indicador
    const clavesVarSet = new Set(clavesVar);
    const clavesIndSet = new Set(clavesInd);

    for (const indicador of indicadores) {
      const id = indicador.nombre || indicador.clave || '[sin nombre]';
      if (!indicador.clave?.trim()) errores.push(`Indicador "${id}": falta la clave.`);
      if (!indicador.nombre?.trim()) errores.push(`Indicador "${id}": falta el nombre.`);
      if (!indicador.estrategia_tipo) {
        errores.push(`Indicador "${id}": debe tener una estrategia de cálculo.`);
        continue;
      }

      const config = indicador.configuracion || {};
      const tipo = indicador.estrategia_tipo;

      if (tipo === 'porcentaje') {
        if (!config.numerador) errores.push(`Indicador "${id}": falta el numerador.`);
        else if (!clavesVarSet.has(config.numerador) && !clavesIndSet.has(config.numerador)) {
          errores.push(`Indicador "${id}": numerador "${config.numerador}" no existe.`);
        }
        if (!config.denominador) errores.push(`Indicador "${id}": falta el denominador.`);
        else if (!clavesVarSet.has(config.denominador) && !clavesIndSet.has(config.denominador)) {
          errores.push(`Indicador "${id}": denominador "${config.denominador}" no existe.`);
        }
      }

      if (tipo === 'absoluto') {
        const vk = config.variable_clave || config.variable;
        if (!vk) errores.push(`Indicador "${id}": falta la variable fuente.`);
        else if (!clavesVarSet.has(vk))
          errores.push(`Indicador "${id}": variable "${vk}" no declarada.`);
      }

      if (tipo === 'promedio') {
        const vars = config.variables || [];
        if (vars.length === 0)
          errores.push(`Indicador "${id}": debe especificar al menos una variable.`);
        else
          for (const v of vars) {
            if (!clavesVarSet.has(v))
              errores.push(`Indicador "${id}": variable "${v}" no declarada.`);
          }
      }

      if (tipo === 'formula') {
        const expr = config.expresion || config.formula || '';
        if (!expr.trim()) errores.push(`Indicador "${id}": la expresión de fórmula está vacía.`);
      }
    }

    // ── ADVERTENCIAS ─────────────────────────────────────────────────────────

    const indSinEscalas = indicadoresActivos.filter((i) => !i.escalas?.length);
    if (indSinEscalas.length > 0) {
      advertencias.push(
        `Indicadores sin escalas de clasificación: ${indSinEscalas.map((i) => i.nombre || i.clave).join(', ')}`
      );
    }

    if (!protocolo.umbrales?.length && !protocolo.reglas?.length) {
      advertencias.push('Sin umbrales ni reglas de alerta: no se generarán alertas automáticas.');
    }

    const inactivos = indicadores.filter((i) => i.activo === false);
    if (inactivos.length > 0) {
      advertencias.push(`${inactivos.length} indicador(es) inactivos no se calcularán.`);
    }

    return { valido: errores.length === 0, errores, advertencias };
  }
}
