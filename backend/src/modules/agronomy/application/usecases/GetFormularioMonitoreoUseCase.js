/**
 * GetFormularioMonitoreoUseCase.js
 *
 * Caso de uso principal del módulo de monitoreos.
 * Resuelve en una sola consulta atómica todo lo que el frontend necesita
 * para construir el formulario de evaluación dinámico:
 *   - Cultivo y estado fenológico del lote
 *   - Objetos de evaluación aplicables
 *   - Protocolo vigente con variables, escalas y unidades
 *   - Umbrales económicos
 *   - Reglas agronómicas activas
 *
 * El frontend hace UNA sola petición:
 *   GET /api/v1/agronomia/lotes/:id/formulario-monitoreo
 */
export class GetFormularioMonitoreoUseCase {
  constructor(agronomyRepository) {
    this.repo = agronomyRepository;
  }

  async execute(loteId) {
    // 1. Obtener datos del lote y su cultivo asociado
    const lote = await this.repo.getLoteConCultivo(loteId);
    if (!lote) {
      return { success: false, error: 'Lote no encontrado', data: null };
    }

    // Resolver el cultivo: primero por referencia FK, luego por nombre legado
    const cultivo = lote.cultivo_ref || null;
    const cultivoId = cultivo?.id || null;

    // Resolver el estado fenológico del lote
    let estadoFenologicoId = null;
    let estadoFenologicoNombre = lote.estado_fenologico || null;

    if (cultivoId && estadoFenologicoNombre) {
      const estados = await this.repo.getEstadosFenologicos(cultivoId);
      // Normalizar para comparación resiliente a acentos y mayúsculas
      const normalize = (s) =>
        s
          ?.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      const estadoMatch = estados.find(
        (e) => normalize(e.nombre) === normalize(estadoFenologicoNombre)
      );
      estadoFenologicoId = estadoMatch?.id || null;
    }

    // 2. Obtener objetos de evaluación aplicables
    let objetos = [];
    if (cultivoId) {
      objetos = await this.repo.getObjetosEvaluacion(cultivoId, estadoFenologicoId);
    }

    // 3. Para cada objeto, obtener su protocolo vigente y umbrales
    const objetosConProtocolo = await Promise.all(
      objetos.map(async (obj) => {
        const [protocolo, umbrales] = await Promise.all([
          this.repo.getProtocoloVigente(obj.id, cultivoId, estadoFenologicoId),
          this.repo.getUmbralesEconomicos(obj.id, cultivoId, estadoFenologicoId)
        ]);

        return {
          ...obj,
          protocolo: protocolo
            ? {
                id: protocolo.id,
                version: protocolo.version,
                vigencia_desde: protocolo.vigencia_desde,
                variables: protocolo.variables,
                frecuencia_dias: protocolo.frecuencia_dias,
                tamanio_muestra: protocolo.tamanio_muestra,
                metodologia: protocolo.metodologia
              }
            : null,
          umbrales
        };
      })
    );

    // 4. Obtener reglas agronómicas activas para el cultivo
    const reglas = cultivoId ? await this.repo.getReglasAgronomicas(cultivoId) : [];

    // 5. Construir la respuesta
    return {
      success: true,
      data: {
        lote: {
          id: lote.id,
          codigo_interno: lote.codigo_interno,
          nombre: lote.nombre,
          estado_fenologico: estadoFenologicoNombre,
          estado_fenologico_id: estadoFenologicoId
        },
        cultivo: cultivo
          ? {
              id: cultivo.id,
              nombre: cultivo.nombre_comun,
              nombre_cientifico: cultivo.nombre_cientifico
            }
          : { id: null, nombre: lote.cultivo, nombre_cientifico: null },
        objetos: objetosConProtocolo,
        reglas_agronomicas: reglas,
        metadata: {
          total_objetos: objetosConProtocolo.length,
          objetos_con_protocolo: objetosConProtocolo.filter((o) => o.protocolo !== null).length,
          generado_en: new Date().toISOString()
        }
      }
    };
  }
}
