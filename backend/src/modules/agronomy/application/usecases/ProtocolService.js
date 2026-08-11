import { ProtocolAssembler } from '../../domain/services/ProtocolAssembler.js';
import { DatabaseError } from '../../../../shared/errors/AppErrors.js';
import { ProtocolValidatorService } from '../../domain/services/ProtocolValidatorService.js';

/**
 * ProtocolService
 *
 * Capa de Aplicación / Reglas de Negocio del módulo de Protocolos.
 *
 * Responsabilidades:
 *   - Creación de nuevos protocolos (borrador o activo)
 *   - Edición con inmutabilidad: un protocolo activo NO puede modificarse
 *     directamente. Se crea una nueva versión en borrador.
 *   - Publicación: borrador → activo + archivo de versión previa
 *   - Clonación preservando entidades relacionales
 *   - Obtención del protocolo completo ensamblado (cabecera + variables +
 *     indicadores + escalas + umbrales + reglas)
 *
 * Esta clase NO conoce Supabase, Express ni React.
 * Solo habla con ProtocolRepository y ProtocolAssembler.
 */
export class ProtocolService {
  constructor(protocolRepository) {
    this.repo = protocolRepository;
  }

  // ─── Listado ──────────────────────────────────────────────────────────────

  /**
   * Retorna la biblioteca de protocolos con métricas de conteo reales.
   */
  async listar(filters = {}) {
    const rows = await this.repo.listProtocolos(filters);
    return ProtocolAssembler.fromDBList(rows);
  }

  // ─── Obtener protocolo completo ───────────────────────────────────────────

  /**
   * Retorna el objeto de dominio completamente ensamblado para un protocolo.
   * Llama a la función PostgreSQL get_protocolo_completo() para obtener
   * todas las entidades relacionales en una sola query.
   */
  async obtener(id) {
    const {
      cabecera,
      variables,
      umbrales,
      reglas,
      indicadores = []
    } = await this.repo.getProtocoloCompleto(id);
    return ProtocolAssembler.fromDB(cabecera, variables, umbrales, reglas, indicadores);
  }

  // ─── Historial de versiones ───────────────────────────────────────────────

  async historial(objetoId, cultivoId) {
    return this.repo.getHistorialVersiones(objetoId, cultivoId);
  }

  // ─── Crear protocolo ──────────────────────────────────────────────────────

  /**
   * Crea un nuevo protocolo. Persiste cabecera + entidades relacionales.
   * Si estado === 'activo', archiva la versión previa del mismo objeto.
   *
   * @param {ProtocoloDominio} domainObj
   * @param {string} estado - 'borrador' | 'activo'
   * @param {string} userId
   */
  async crear(domainObj, estado = 'borrador', userId) {
    // 1. Resolver objeto de evaluación (buscar/crear si no tiene UUID)
    const objetoId = await this.repo.resolveObjetoEvaluacion(
      domainObj.objeto_evaluacion_id,
      domainObj.objeto_nombre
    );

    const estadoFinal = domainObj.estado || estado || 'borrador';

    // 2. Construir payload de cabecera
    const cabecerPayload = {
      ...ProtocolAssembler.toDBCabecera(domainObj, estadoFinal),
      objeto_evaluacion_id: objetoId,
      created_by: userId,
      updated_by: userId
    };

    // 3. Si se publica, archivar versión previa
    if (estadoFinal === 'activo' && objetoId) {
      await this.repo.archivarVersionPrevia(objetoId, cabecerPayload.cultivo_id, userId);
    }

    // 4. Insertar cabecera
    const protocoloCreado = await this.repo.insertCabecera(cabecerPayload);

    // 5. Insertar entidades relacionales
    await this._persistirEntidades(protocoloCreado.id, domainObj);

    // 6. Retornar protocolo completo ensamblado
    return this.obtener(protocoloCreado.id);
  }

  // ─── Editar protocolo ─────────────────────────────────────────────────────

  /**
   * Edita un protocolo con respeto a la inmutabilidad:
   *
   *   - Si el protocolo está en estado BORRADOR: actualiza directamente.
   *     Si se cambia su estado a ACTIVO, archiva la versión activa anterior.
   *   - Si el protocolo está ACTIVO: NO puede modificarse.
   *     En su lugar, crea automáticamente un nuevo borrador con versión
   *     incrementada y preserva la versión activa intacta.
   *
   * @returns {{ protocolo: ProtocoloDominio, nuevaVersion: boolean }}
   */
  async editar(id, domainObj, userId) {
    const actual = await this.repo.getCabecera(id);
    if (!actual) throw new DatabaseError(`Protocolo ${id} no encontrado`);

    const estadoDestino = domainObj.estado || actual.estado;

    // Regla de inmutabilidad: si el protocolo ya está ACTIVO y se intenta editar en BORRADOR o cambiar contenido
    if (
      actual.estado === 'activo' &&
      domainObj.estado !== 'archivado' &&
      domainObj.estado !== 'obsoleto' &&
      domainObj.estado !== 'activo'
    ) {
      // Crear nueva versión en borrador con versión incrementada
      const nuevaVersion = this._incrementarVersion(actual.version);
      const nuevoDominio = {
        ...domainObj,
        version: nuevaVersion,
        estado: 'borrador'
      };
      const nuevo = await this.crear(nuevoDominio, 'borrador', userId);
      return { protocolo: nuevo, nuevaVersion: true };
    }

    // Protocolo en borrador o cambio de estado: actualizar directamente
    const cabeceraPayload = {
      ...ProtocolAssembler.toDBCabecera(domainObj, estadoDestino),
      updated_by: userId
    };

    // Si se activa este protocolo, archivar cualquier versión activa previa del mismo objeto/cultivo
    if (estadoDestino === 'activo' && actual.estado !== 'activo') {
      const objetoId = actual.objeto_evaluacion_id || domainObj.objeto_evaluacion_id;
      if (objetoId) {
        await this.repo.archivarVersionPrevia(objetoId, cabeceraPayload.cultivo_id, userId, id);
      }
    }

    await this.repo.updateCabecera(id, cabeceraPayload);

    // Reemplazar entidades relacionales (delete + insert)
    await this.repo.deleteEntidadesRelacionales(id);
    await this._persistirEntidades(id, domainObj);

    return { protocolo: await this.obtener(id), nuevaVersion: false };
  }

  // ─── Publicar protocolo ───────────────────────────────────────────────────

  /**
   * Transiciona un protocolo de BORRADOR a ACTIVO.
   * Archiva la versión activa previa del mismo objeto/cultivo.
   */
  async publicar(id, userId, comentario) {
    const actual = await this.repo.getCabecera(id);
    if (!actual) throw new DatabaseError(`Protocolo ${id} no encontrado`);
    if (actual.estado === 'activo') {
      throw new Error('El protocolo ya está activo. Para modificarlo, use editar().');
    }

    // ── VALIDAR protocolo antes de publicar ──────────────────────────────
    const protocoloCompleto = await this.obtener(id);
    const { valido, errores, advertencias } = ProtocolValidatorService.validate(protocoloCompleto);

    if (advertencias?.length > 0) {
      console.warn(`[ProtocolService] Advertencias al publicar protocolo ${id}:`, advertencias);
    }

    if (!valido) {
      throw new Error(
        'El protocolo no puede publicarse porque tiene errores de configuración:\n' +
          errores.map((e) => `  • ${e}`).join('\n')
      );
    }

    // Archivar versión previa activa
    if (actual.objeto_evaluacion_id) {
      await this.repo.archivarVersionPrevia(
        actual.objeto_evaluacion_id,
        actual.cultivo_id,
        userId,
        id // excluir el propio
      );
    }

    await this.repo.updateCabecera(id, {
      estado: 'activo',
      vigencia_desde: new Date().toISOString().split('T')[0],
      vigencia_hasta: null,
      audit_comentario: comentario || `Protocolo publicado por ${userId}`,
      updated_by: userId,
      updated_at: new Date().toISOString()
    });

    return this.obtener(id);
  }

  // ─── Clonar protocolo ─────────────────────────────────────────────────────

  /**
   * Duplica un protocolo (cabecera + entidades relacionales) como borrador.
   */
  async clonar(id, userId) {
    const original = await this.obtener(id);
    if (!original) throw new DatabaseError(`Protocolo ${id} no encontrado`);

    const clon = {
      ...original,
      nombre: `${original.nombre} (Copia)`,
      version: '1.0',
      estado: 'borrador',
      audit_comentario: `Clonado desde v${original.version} (ID: ${id})`
    };

    return this.crear(clon, 'borrador', userId);
  }

  // ─── Eliminar protocolo ───────────────────────────────────────────────────

  async eliminar(id) {
    // Las FK con ON DELETE CASCADE eliminan las entidades relacionales automáticamente
    return this.repo.deleteProtocolo(id);
  }

  // ─── Importar desde JSON externo ──────────────────────────────────────────

  async importar(json, userId) {
    return this.crear(json, 'borrador', userId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Inserta las entidades relacionales de un protocolo ya creado.
   * Orden: variables → escalas → umbrales → reglas.
   */
  async _persistirEntidades(protocolo_id, domainObj) {
    const variables = domainObj.variables || [];
    const indicadores = domainObj.indicadores || [];
    const umbrales = domainObj.umbrales || [];
    const reglas = domainObj.reglas || [];

    // Insertar variables y obtener el mapa clave→UUID
    const variableIdMap = await this.repo.insertVariables(
      protocolo_id,
      ProtocolAssembler.toDBVariables(protocolo_id, variables)
    );

    // Insertar indicadores agronómicos (incluye sus escalas internamente)
    // Retorna indicadorIdMap para el mapeo indicador↔variable
    const indicadorIdMap = await this.repo.insertIndicadores(protocolo_id, indicadores);

    // Insertar mapeos indicador↔variable (N-a-M)
    await this.repo.insertIndicadorVariables(indicadorIdMap, variableIdMap, indicadores);

    // Insertar escalas legadas en variables (para retrocompatibilidad)
    const escalasPayload = ProtocolAssembler.toDBEscalas(protocolo_id, variables, variableIdMap);
    if (escalasPayload.length > 0) {
      await this.repo.insertEscalas(protocolo_id, escalasPayload);
    }

    // Insertar umbrales
    if (umbrales.length > 0) {
      await this.repo.insertUmbrales(
        protocolo_id,
        ProtocolAssembler.toDBUmbrales(protocolo_id, umbrales)
      );
    }

    // Insertar reglas
    if (reglas.length > 0) {
      await this.repo.insertReglas(
        protocolo_id,
        ProtocolAssembler.toDBReglas(protocolo_id, reglas)
      );
    }
  }

  /**
   * Incrementa la versión semántica:
   *   1.0 → 1.1
   *   1.9 → 1.10
   *   2.0 → 2.1
   */
  _incrementarVersion(version) {
    if (!version || typeof version !== 'string') return '1.1';
    const partes = version.split('.');
    if (partes.length === 2) {
      const [mayor, menor] = partes.map(Number);
      return `${mayor}.${menor + 1}`;
    }
    return `${version}.1`;
  }
}
