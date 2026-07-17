# Diccionario de Datos: SkyCrop Database V2.0.0

Este documento contiene la especificación técnica de la base de datos de SkyCrop (V2.0.0), organizada por dominios funcionales bajo principios de desacoplamiento modular.

---

## 1. Dominios Funcionales

La base de datos está organizada en los siguientes dominios:
- **CORE**: Identidad, empresas, perfiles, membresías, predios y lotes.
- **AGRONOMÍA / MANEJO SANITARIO**: Catálogo de insumos y aplicaciones fitosanitarias.
- **INVENTARIO / BODEGAS**: Stock de insumos, bodegas físicas y Kardex de movimientos.
- **RECURSOS HUMANOS (RRHH)**: Contratos de trabajadores y cuadrillas de campo.
- **FINANZAS / COSTOS**: Nóminas de pago y libro mayor de costos de lotes.
- **MONITOREO / EVALUACIÓN**: Registros de formación, capacitaciones e inspecciones fitosanitarias.
- **STORAGE Y AUDITORÍA**: Buckets de almacenamiento, bitácoras de auditoría y seguridad.

---

## 2. Definiciones de Tablas por Dominio

### Dominio: CORE

#### Tabla: `companies`
Representa a los inquilinos (Tenants) del sistema, vinculados a organizaciones de Clerk.
- **`id`** `UUID` (PRIMARY KEY) - Identificador interno único autogenerado.
- **`clerk_org_id`** `TEXT` (UNIQUE, NOT NULL) - ID de la organización en Clerk.
- **`nombre`** `TEXT` (NOT NULL) - Nombre comercial.
- **`slug`** `TEXT` - Slug identificador.
- **`nit`** `TEXT` - Identificación tributaria.
- **`telefono`** `phone_number` - Teléfono validado.
- **`correo`** `email_address` - Correo electrónico validado.
- **`direccion`** `TEXT` - Dirección física.
- **`logo`** `TEXT` - URL del logo corporativo.
- **`estado`** `TEXT` (DEFAULT 'active') - Estado ('active', 'inactive', 'suspended').
- **`created_at`, `updated_at`** `TIMESTAMPTZ` - Auditoría.

#### Tabla: `profiles`
Cache local de perfiles de usuario autenticados por Clerk.
- **`id`** `TEXT` (PRIMARY KEY) - ID del usuario en Clerk (`user_...`).
- **`email`** `email_address` (UNIQUE, NOT NULL) - Correo electrónico.
- **`nombre`** `TEXT` - Primer nombre.
- **`apellido`** `TEXT` - Apellido.
- **`created_at`, `updated_at`** `TIMESTAMPTZ` - Auditoría.

#### Tabla: `company_users`
Relación N:M que define las membresías de usuarios en organizaciones y sus roles.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK -> `companies.id` ON DELETE CASCADE)
- **`clerk_user_id`** `TEXT` (FK -> `profiles.id` ON DELETE CASCADE)
- **`role_id`** `TEXT` (FK -> `roles.id` ON DELETE RESTRICT)
- **`activo`** `BOOLEAN` (DEFAULT true) - Indica si la membresía está activa.
- **`status`** `TEXT` (DEFAULT 'active') - Estado ('active', 'inactive', 'pending').
- **`created_at`, `updated_at`** `TIMESTAMPTZ` - Auditoría.

#### Tabla: `roles`
Roles del sistema configurables.
- **`id`** `TEXT` (PRIMARY KEY) - Código único en minúsculas.
- **`nombre`** `TEXT` (NOT NULL) - Nombre visual.
- **`descripcion`** `TEXT` - Descripción de alcances.

#### Tabla: `permisos`
Definición de permisos RBAC granular de base de datos.
- **`id`** `UUID` (PRIMARY KEY)
- **`rol_id`** `TEXT` (FK -> `roles.id` ON DELETE CASCADE)
- **`recurso`** `TEXT` (NOT NULL) - Recurso del sistema (e.g. `'lotes'`, `'inventario'`, `'*'`).
- **`accion`** `TEXT` (NOT NULL) - Operación permitida (e.g. `'leer'`, `'todo'`).

#### Tabla: `predios`
Unidad territorial primaria (Fincas).
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK -> `companies.id` ON DELETE CASCADE)
- **`nombre`** `TEXT` (NOT NULL) - Nombre de la finca.
- **`ubicacion`** `TEXT` - Ubicación geográfica textual.
- **`area_total_ha`** `NUMERIC` - Área total del predio.

#### Tabla: `lotes`
Parcelas georreferenciadas que componen un predio.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK -> `companies.id` ON DELETE CASCADE)
- **`predio_id`** `UUID` (FK -> `predios.id` ON DELETE SET NULL)
- **`codigo_interno`** `VARCHAR(50)` (NOT NULL) - Código del lote único por empresa.
- **`nombre`** `VARCHAR(100)` (NOT NULL) - Nombre descriptivo.
- **`cultivo`** `VARCHAR(100)` (NOT NULL) - Tipo de cultivo (e.g. Café, Soya).
- **`geom`** `GEOMETRY` (PostGIS) - Límite geográfico del lote (Polígono).
- **`area_ha`, `perimetro_m`** `DOUBLE PRECISION` - Datos geométricos.
- **`estado_sanitario`** `VARCHAR` (DEFAULT 'excelente') - Estado general de salud.
- **`ndvi_actual`** `DOUBLE PRECISION` - Valor NDVI satelital.
- **`carencia_activa`** `BOOLEAN` (DEFAULT false) - Bandera de bloqueo por aplicación.
- **`fecha_fin_carencia`** `TIMESTAMPTZ` - Fecha límite de cosecha segura.
- **`producto_carencia`** `TEXT` - Nombre del producto aplicado causante de la carencia.
- **`deleted_at`, `deleted_by`** - Auditoría de soft delete.

---

### Dominio: RECURSOS HUMANOS (RRHH)

#### Tabla: `trabajadores`
Ficha del personal de campo.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK -> `companies.id` ON DELETE CASCADE)
- **`nombres`, `apellidos`, `identificacion`** `TEXT` (NOT NULL)
- **`tipo_contrato`** `TEXT` (NOT NULL) - Tipo de contrato laboral.
- **`estado`** `TEXT` (NOT NULL) - Estado ('Activo', 'Inactivo', etc.).
- **`rol`** `TEXT` (NOT NULL) - Cargo o rol del trabajador.

#### Tabla: `cuadrillas`
Agrupación de trabajadores para labores de campo.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`nombre`** `TEXT` (NOT NULL)

#### Tabla: `cuadrilla_miembros`
Tabla intermedia de trabajadores vinculados a cuadrillas.
- **`cuadrilla_id`** `UUID` (FK)
- **`trabajador_id`** `UUID` (FK)
- **`company_id`** `UUID` (FK)

---

### Dominio: BODEGAS E INVENTARIO

#### Tabla: `bodegas`
Espacios físicos para resguardo de bienes e insumos.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`nombre`, `sector`, `categoria`** `VARCHAR` (NOT NULL)
- **`responsable_id`** `UUID` (FK -> `trabajadores.id`)

#### Tabla: `inventario`
Control de stock de agroquímicos, fertilizantes y EPP.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`name`** `TEXT` (NOT NULL)
- **`category`** `TEXT` (NOT NULL) - Categoría del producto.
- **`quantity`** `DOUBLE PRECISION` (DEFAULT 0.0) - Existencias en stock.
- **`min_quantity`** `DOUBLE PRECISION` - Alerta de stock mínimo.
- **`warehouse_id`** `UUID` (FK -> `bodegas.id`)

#### Tabla: `movimientos_inventario`
Kardex transaccional para auditoría e inventario.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`item_id`** `UUID` (FK -> `inventario.id`)
- **`cantidad`** `NUMERIC` - Cantidad movida.
- **`tipo`** `VARCHAR` - Entrada, Salida o Ajuste.
- **`antes`, `despues`** `NUMERIC` - Stock histórico.
- **`motivo`** `TEXT` - Razón del movimiento.

---

### Dominio: AGRONOMÍA Y EJECUCIÓN

#### Tabla: `productos`
Catálogo de agroinsumos de ICA y personalizados.
- **`id`** `BIGINT` (PRIMARY KEY)
- **`company_id`** `UUID` (FK, NULLable) - NULL indica registro global del catálogo nacional.

#### Tabla: `aplicaciones`
Registro de fumigaciones fitosanitarias y fertilizaciones.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`lote_id`** `UUID` (FK -> `lotes.id`)
- **`producto_comercial`** `VARCHAR` (NOT NULL)
- **`fecha_aplicacion`** `TIMESTAMPTZ` (NOT NULL)
- **`periodo_carencia_dias`** `INTEGER` - Días de espera para cosecha.
- **`costo_aplicacion`** `DOUBLE PRECISION` - Costo total asignado.

#### Tabla: `cosechas`
Registro del rendimiento de recolección de cultivos por lote.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`lote_id`** `UUID` (FK -> `lotes.id`)
- **`crop`** `TEXT` (NOT NULL) - Cultivo cosechado.
- **`weight`** `DOUBLE PRECISION` (NOT NULL) - Peso recolectado en kilogramos.
- **`grade`** `TEXT` (NOT NULL) - Calidad.

---

### Dominio: MAQUINARIA

#### Tabla: `maquinaria`
Flota de vehículos y tractores agrícolas.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`codigo_id`** `VARCHAR` (NOT NULL) - Código interno.
- **`hours_of_operation`** `NUMERIC` - Horómetro acumulado.
- **`cost_operator`, `cost_fuel`, `cost_maintenance`, `cost_depreciation`** `NUMERIC` - Costos unitarios por hora.

#### Tabla: `jornadas_maquinaria`
Shifts de trabajo y consumo de combustible de maquinaria.
- **`id`** `UUID` (PRIMARY KEY)
- **`maquinaria_id`** `UUID` (FK -> `maquinaria.id`)
- **`operator`** `VARCHAR` - Operario.
- **`lot`** `VARCHAR` - Lote de trabajo.
- **`calculated_cost`** `NUMERIC` - Costo calculado de la jornada.

---

### Dominio: FINANZAS Y COSTOS

#### Tabla: `costos`
Libro diario de costos consolidados.
- **`id`** `UUID` (PRIMARY KEY)
- **`company_id`** `UUID` (FK)
- **`lote_id`** `UUID` (FK -> `lotes.id`)
- **`concepto`** `TEXT` (NOT NULL) - 'Insumos', 'Mano de Obra', 'Maquinaria', 'Otros'.
- **`costo`** `NUMERIC` (NOT NULL) - Monto en pesos.
- **`referencia_tipo`** `TEXT` - Tabla origen (e.g. `'aplicaciones'`).
- **`referencia_id`** `UUID` - ID de la fila origen.

---

## 3. Automatizaciones y Triggers de Integración

1. **`auto_predio_lotes_trg`** (`lotes` BEFORE INSERT):
   Si se inserta un lote con `predio_id` nulo, busca un predio existente en la empresa o autogenera un "Predio Principal" para evitar registros huérfanos.
2. **`carencia_aplicaciones_trg`** (`aplicaciones` AFTER INSERT/UPDATE):
   Si la aplicación tiene días de carencia, bloquea el lote asignando `carencia_activa = true`, calcula `fecha_fin_carencia`, y genera una alerta en la tabla de `alertas`.
3. **`audit_<tabla>_trigger`** (Tablas operativas AFTER INSERT/UPDATE/DELETE):
   Ejecuta `process_audit_log` para registrar el payload modificado (`antes`/`despues`) en `audit_logs`.
4. **`secure_company_id_trg`** (Tablas operativas BEFORE INSERT/UPDATE):
   Inyecta automáticamente `company_id = current_company()` si viene vacío y rechaza falsificaciones de inquilino (`FORGERY_ATTEMPT`).

---

## 4. Servicios de Dominio (Funciones RPC / SQL)

- **`consumir_inventario_por_aplicacion(...)`**:
  Resta la dosis de insumo de `inventario`, inserta una fila en el Kardex (`movimientos_inventario`), evalúa si se superó el límite crítico de stock generando una alerta de `STOCK_MINIMO`, y retorna los estados del stock.
- **`registrar_costo_lote(...)`**:
  Registra centralizadamente un costo en el libro mayor (`costos`), enlazándolo a su recurso fuente para auditoría.
- **`registrar_historial_actividad(...)`**:
  Registra hitos agronómicos en la línea de tiempo del lote (`historial_actividades`).
