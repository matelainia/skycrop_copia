import { supabase } from '../../../lib/supabaseClient';
import { Machine } from '../types/Machine';

/**
 * Data Access Layer for Machinery fleet — contrato 052/053/054.
 * Lecturas con select explícito (nunca select('*')); escrituras críticas
 * (alta) vía RPC registrar_maquinaria. Los campos operativos
 * (estado, horómetro, operador actual) son propiedad de las RPC y el trigger
 * 053 los sincroniza; este repositorio NO los escribe directo.
 */
const FLEET_COLUMNS = [
  'id', 'company_id',
  'codigo', 'codigo_id', 'nombre', 'name', 'tipo', 'type',
  'estado', 'status', 'marca', 'modelo', 'serial', 'placa', 'anio',
  'fecha_adquisicion', 'horometro_actual', 'hours_of_operation', 'hours_today',
  'operator_name', 'current_task', 'current_lot',
  'last_maintenance', 'next_maintenance', 'next_maintenance_hours',
  'fuel_consumption',
  'cost_operator', 'cost_fuel', 'cost_maintenance', 'cost_depreciation',
  'costo_operador_hora', 'costo_combustible_hora',
  'costo_mantenimiento_hora', 'costo_depreciacion_hora',
  'photo_url', 'image_url', 'activo', 'deleted_at', 'created_at', 'updated_at'
].join(',');

const sanitizeSearch = (q = '') => String(q).replace(/[%(),]/g, '').trim();

export class MachineryRepository {
  /**
   * Fetch fleet machinery (paginado en servidor; por defecto lote amplio
   * para no romper la UI actual que pagina en cliente — paso 9 lo migra).
   */
  async getAll({ limit = 500, offset = 0, search = '', estado = null } = {}) {
    let query = supabase
      .from('maquinaria')
      .select(FLEET_COLUMNS)
      .order('codigo', { ascending: true })
      .range(offset, offset + limit - 1);

    const q = sanitizeSearch(search);
    if (q) {
      query = query.or(`codigo.ilike.%${q}%,nombre.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
    }
    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error fetching machinery:', error.message);
      throw error;
    }
    return (data || []).map(Machine.fromDatabase);
  }

  async getById(id) {
    const { data, error } = await supabase
      .from('maquinaria')
      .select(FLEET_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching machine:', error.message);
      throw error;
    }
    return Machine.fromDatabase(data);
  }

  /**
   * Alta vía RPC (contrato §8) + update de atributos maestros suplementarios
   * (costos/hora, mantenimientos, foto) que la RPC no recibe.
   */
  async create(machine) {
    const { data, error } = await supabase.rpc('registrar_maquinaria', {
      p_codigo: machine.codigoId?.toUpperCase().trim(),
      p_nombre: machine.name?.trim(),
      p_tipo: machine.type || 'Tractor',
      p_marca: machine.marca?.trim() || null,
      p_modelo: machine.modelo?.trim() || null,
      p_serial: machine.serial?.trim() || null,
      p_placa: machine.placa?.trim() || null,
      p_anio: Number.isFinite(Number(machine.anio)) ? Number(machine.anio) : null,
      p_fecha_adquisicion: machine.fechaAdquisicion || null,
      p_horometro_inicial: Number(machine.hoursOfOperation) || 0
    });

    if (error) {
      console.error('RPC error creating machinery:', error.message);
      throw error;
    }
    if (!data?.success || !data?.maquinaria_id) {
      throw new Error('La base de datos rechazó el registro de maquinaria.');
    }

    const extras = this.toMaestrosUpdate(machine);
    if (Object.keys(extras).length > 0) {
      // H-05: única escritura directa permitida — fila recién creada por la RPC
      // en este mismo flujo (sin segundo camino de edición).
      const { error: updateError } = await supabase
        .from('maquinaria')
        .update(extras)
        .eq('id', data.maquinaria_id);
      if (updateError) {
        console.error('Database error completing machinery record:', updateError.message);
        throw updateError;
      }
    }

    return this.getById(data.maquinaria_id);
  }

  /**
   * H-05 — VÍA LEGACY BLOQUEADA (fail-closed).
   * Existían dos caminos de escritura (UPDATE directo + RPC 052) con distinto
   * nivel de autorización. La edición de maestros queda bloqueada hasta contar
   * con RPC contractual (`actualizar_maestros_maquinaria`) o policy RLS con
   * gate de rol. Ver docs/maquinaria/diagnostico-integral/05-hallazgos.md.
   *
   * Update de MAESTROS únicamente. Excluye a propósito los campos operativos
   * (estado, horómetro, operador/labor/lote actuales): son propiedad de las
   * RPC de jornada/mantenimiento/horómetro (contrato §3/§4/§8).
   */
  async update() {
    throw new Error(
      'Edición directa bloqueada por contrato de seguridad (H-05): ' +
      'la escritura de maestros requiere RPC autorizada. ' +
      'Estado: NO CERTIFICADO — ver remediación.'
    );
  }

  /**
   * H-05 — DELETE directo BLOQUEADO (fail-closed).
   * El borrado físico por REST es un segundo camino sin autorización de
   * negocio. Retirar = pasar a 'Fuera de servicio' vía incidencia RPC
   * (052-07.8). Delete físico solo vía SQL administrado con auditoría.
   */
  async delete() {
    throw new Error(
      'Eliminación directa bloqueada por contrato de seguridad (H-05): ' +
      'retire el equipo (Fuera de servicio) en lugar de eliminarlo.'
    );
  }

  /**
   * Mapea un formulario/modelo parcial a columnas de maestros.
   * Solo incluye claves definidas: seguro para updates parciales.
   */
  toMaestrosUpdate(machine = {}) {
    const payload = {};
    const text = (v) => (v === undefined || v === null ? undefined : String(v).trim() || undefined);
    const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

    const codigo = text(machine.codigo ?? machine.codigoId);
    if (codigo) {
      payload.codigo = codigo.toUpperCase();
      payload.codigo_id = codigo.toUpperCase();
    }
    const nombre = text(machine.nombre ?? machine.name);
    if (nombre) {
      payload.nombre = nombre;
      payload.name = nombre;
    }
    const tipo = text(machine.tipo ?? machine.type);
    if (tipo) {
      payload.tipo = tipo;
      payload.type = tipo;
    }
    for (const key of ['marca', 'modelo', 'serial', 'placa', 'unidad_capacidad']) {
      const v = text(machine[key]);
      if (v !== undefined) payload[key] = v;
    }
    const anio = num(machine.anio);
    if (anio !== undefined) payload.anio = anio;
    const capacidad = num(machine.capacidad ?? machine.unidadCapacidad);
    if (capacidad !== undefined) payload.capacidad = capacidad;
    if (machine.fechaAdquisicion) payload.fecha_adquisicion = machine.fechaAdquisicion;
    if (machine.lastMaintenance) payload.last_maintenance = machine.lastMaintenance;
    if (machine.nextMaintenance) payload.next_maintenance = machine.nextMaintenance;
    const nextHours = num(machine.nextMaintenanceHours);
    if (nextHours !== undefined) payload.next_maintenance_hours = nextHours;
    const fuel = text(machine.fuelConsumption);
    if (fuel !== undefined) payload.fuel_consumption = fuel;
    const costPairs = [
      ['costOperator', 'costo_operador_hora', 'cost_operator'],
      ['costFuel', 'costo_combustible_hora', 'cost_fuel'],
      ['costMaintenance', 'costo_mantenimiento_hora', 'cost_maintenance'],
      ['costDepreciation', 'costo_depreciacion_hora', 'cost_depreciation']
    ];
    for (const [modelKey, canonKey, legacyKey] of costPairs) {
      const v = num(machine[modelKey]);
      if (v !== undefined) {
        payload[canonKey] = v;
        payload[legacyKey] = v;
      }
    }
    const photo = text(machine.photoUrl);
    if (photo !== undefined) {
      payload.photo_url = photo;
      payload.image_url = photo;
    }
    return payload;
  }
}

export const machineryRepository = new MachineryRepository();
export default machineryRepository;
