import React, { useMemo } from 'react';

/* ─────────────────────────────────────────────────────────────
   DynamicMonitoringForm.jsx
   Formulario 100% data-driven para el módulo de Monitoreos.
   El backend provee en una sola llamada:
     - Cultivo + Etapa Fenológica del lote
     - Objetos de evaluación aplicables (plagas, enfermedades, etc.)
     - Protocolo versionado con variables, escalas y unidades
     - Umbrales económicos
     - Reglas agronómicas
   ───────────────────────────────────────────────────────────── */

const COLORES_RELEVANCIA = {
  critica: { bg: '#ff3b3b22', border: '#ff3b3b', badge: '#ff3b3b' },
  alta:    { bg: '#ff7a0022', border: '#ff7a00', badge: '#ff7a00' },
  normal:  { bg: '#22c55e22', border: '#22c55e', badge: '#22c55e' },
  baja:    { bg: '#64748b22', border: '#64748b', badge: '#64748b' }
};

const COLORES_CATEGORIA = {
  'Enfermedad Fúngica':    '#a78bfa',
  'Enfermedad Bacteriana': '#f472b6',
  'Enfermedad Viral':      '#fb923c',
  'Insecto':               '#34d399',
  'Ácaro':                 '#fbbf24',
  'Nematodo':              '#e879f9',
  'Maleza':                '#4ade80',
  'Deficiencia Nutricional': '#38bdf8',
  'Daño Abiótico':         '#94a3b8',
  'Variable Productiva':   '#6ee7b7',
  'Otro':                  '#94a3b8'
};

const NIVEL_RIESGO_ESTILOS = {
  bajo:    { icon: '🟡', color: '#fbbf24', label: 'Riesgo Bajo' },
  medio:   { icon: '🟠', color: '#f97316', label: 'Riesgo Medio' },
  alto:    { icon: '🔴', color: '#ef4444', label: 'Riesgo Alto' },
  critico: { icon: '⚠️', color: '#dc2626', label: 'CRÍTICO' }
};

/* ─────────────────────── STEP 1: Selector de Objeto ─────────────────────── */
const ObjetoSelector = ({ objetos, objetoSeleccionado, onSelect }) => {
  if (!objetos || objetos.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <span style={{ fontSize: '2rem' }}>🌱</span>
        <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>
          No hay objetos de evaluación configurados para este cultivo y etapa.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
        Selecciona el organismo o factor a evaluar:
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '10px'
      }}>
        {objetos.map(obj => {
          const colRel = COLORES_RELEVANCIA[obj.relevancia] || COLORES_RELEVANCIA.normal;
          const colCat = COLORES_CATEGORIA[obj.categoria] || '#94a3b8';
          const isSelected = objetoSeleccionado?.id === obj.id;

          return (
            <button
              key={obj.id}
              onClick={() => onSelect(obj)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '12px',
                background: isSelected ? 'var(--color-accent-green)22' : 'var(--color-surface-2)',
                border: `2px solid ${isSelected ? 'var(--color-accent-green)' : colRel.border}`,
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: colCat,
                  letterSpacing: '0.5px'
                }}>{obj.categoria}</span>
                {obj.relevancia === 'critica' && <span title="Crítica">⚠️</span>}
              </div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--color-text-primary)',
                lineHeight: '1.3'
              }}>
                {obj.nombre_comun}
              </div>
              {obj.nombre_cientifico && (
                <div style={{
                  fontSize: '0.65rem',
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic'
                }}>
                  {obj.nombre_cientifico}
                </div>
              )}
              {!obj.protocolo && (
                <div style={{
                  fontSize: '0.6rem',
                  color: '#94a3b8',
                  marginTop: '2px',
                  padding: '2px 6px',
                  background: '#1e293b',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}>
                  Sin protocolo
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ──────────────────────── STEP 2: Variables del Protocolo ───────────────── */
const VariableInput = ({ variable, valor, onChange }) => {
  const { clave, etiqueta, tipo, unidad, min, max, escala, obligatorio } = variable;

  if (tipo === 'scale' && escala) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{
          fontSize: '0.78rem',
          fontWeight: '600',
          color: 'var(--color-text-secondary)'
        }}>
          {etiqueta}
          {obligatorio && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {escala.map((opcion, i) => (
            <label key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              background: valor === opcion ? 'var(--color-accent-green)22' : 'var(--color-surface-2)',
              border: `1px solid ${valor === opcion ? 'var(--color-accent-green)' : 'var(--color-border)'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: 'var(--color-text-primary)',
              transition: 'all 0.15s ease'
            }}>
              <input
                type="radio"
                name={`var-${clave}`}
                value={opcion}
                checked={valor === opcion}
                onChange={() => onChange(clave, opcion)}
                style={{ accentColor: 'var(--color-accent-green)' }}
              />
              {opcion}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (tipo === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
          {etiqueta}
          {obligatorio && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
        </label>
        <input
          type="checkbox"
          checked={valor === true || valor === 'true'}
          onChange={e => onChange(clave, e.target.checked)}
          style={{ accentColor: 'var(--color-accent-green)', width: '18px', height: '18px' }}
        />
      </div>
    );
  }

  if (tipo === 'text') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
          {etiqueta}
          {obligatorio && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
        </label>
        <textarea
          value={valor || ''}
          onChange={e => onChange(clave, e.target.value)}
          rows={3}
          placeholder={`Ingrese ${etiqueta.toLowerCase()}...`}
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '0.85rem',
            resize: 'vertical',
            outline: 'none'
          }}
        />
      </div>
    );
  }

  // Tipo: number (default)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
        {etiqueta}
        {obligatorio && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
        {unidad && (
          <span style={{
            marginLeft: '8px',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)',
            fontWeight: '400'
          }}>
            ({unidad})
          </span>
        )}
      </label>
      <input
        type="number"
        value={valor ?? ''}
        min={min ?? undefined}
        max={max ?? undefined}
        onChange={e => onChange(clave, e.target.value)}
        required={obligatorio}
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'var(--color-text-primary)',
          fontSize: '0.9rem',
          outline: 'none'
        }}
      />
    </div>
  );
};

/* ───────────────────────── Alertas de Umbral ───────────────────────────── */
const AlertasUmbral = ({ alertas }) => {
  if (!alertas || alertas.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
      {alertas.map((alerta, i) => {
        const estilo = NIVEL_RIESGO_ESTILOS[alerta.nivel_riesgo] || NIVEL_RIESGO_ESTILOS.medio;
        return (
          <div key={i} style={{
            padding: '12px 16px',
            background: `${estilo.color}18`,
            border: `1px solid ${estilo.color}60`,
            borderLeft: `4px solid ${estilo.color}`,
            borderRadius: '8px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px'
            }}>
              <span>{estilo.icon}</span>
              <span style={{ fontWeight: '700', fontSize: '0.8rem', color: estilo.color }}>
                {estilo.label}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
              {alerta.mensaje}
            </p>
            {alerta.recomendacion && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                💡 {alerta.recomendacion}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─────────────────────── Indicador de Incidencia ───────────────────────── */
const IncidenciaIndicator = ({ incidenciaPct }) => {
  if (!incidenciaPct && incidenciaPct !== 0) return null;
  const pct = parseFloat(incidenciaPct);
  const color = pct > 25 ? '#dc2626' : pct > 15 ? '#ef4444' : pct > 5 ? '#f97316' : '#22c55e';

  return (
    <div style={{
      padding: '10px 14px',
      background: `${color}15`,
      border: `1px solid ${color}40`,
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '8px'
    }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
        📊 Incidencia calculada
      </span>
      <span style={{ fontSize: '1.1rem', fontWeight: '700', color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
};

/* ──────────────────────── Componente Principal ─────────────────────────── */
const DynamicMonitoringForm = ({
  formularioMonitoreo,
  formularioCargando,
  formularioError,
  objetoSeleccionado,
  newMonitoreo,
  alertasUmbral,
  onObjetoSelect,
  onValorChange,
  onFieldChange
}) => {
  // Calcular incidencia en tiempo real para mostrar el indicador
  const incidenciaCalculada = useMemo(() => {
    const vals = newMonitoreo.valores_evaluacion;
    const evaluados = vals.frutos_evaluados ?? vals.hojas_evaluadas ?? vals.frutos_muestreados;
    const enfermos  = vals.frutos_enfermos ?? vals.hojas_infectadas ?? vals.frutos_brocados;
    if (evaluados && enfermos !== undefined && parseFloat(evaluados) > 0) {
      return ((parseFloat(enfermos) / parseFloat(evaluados)) * 100).toFixed(2);
    }
    return null;
  }, [newMonitoreo.valores_evaluacion]);

  if (formularioCargando) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 20px' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid var(--color-accent-green)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--color-text-muted)', marginTop: '12px', fontSize: '0.85rem' }}>
          Cargando protocolo de evaluación...
        </p>
      </div>
    );
  }

  if (formularioError) {
    return (
      <div style={{
        padding: '16px',
        background: '#ef444415',
        border: '1px solid #ef444440',
        borderRadius: '10px',
        textAlign: 'center',
        color: '#ef4444',
        fontSize: '0.85rem'
      }}>
        ⚠️ {formularioError}
      </div>
    );
  }

  if (!formularioMonitoreo) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        Selecciona un lote para cargar el protocolo de evaluación.
      </div>
    );
  }

  const { cultivo, lote, objetos } = formularioMonitoreo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Encabezado: Cultivo + Etapa Fenológica */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #22c55e18, #16a34a10)',
        border: '1px solid #22c55e30',
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Cultivo detectado
          </div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
            {cultivo.nombre}
            {cultivo.nombre_cientifico && (
              <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                ({cultivo.nombre_cientifico})
              </span>
            )}
          </div>
        </div>
        {lote.estado_fenologico && (
          <div style={{
            padding: '4px 12px',
            background: '#22c55e22',
            border: '1px solid #22c55e60',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#22c55e'
          }}>
            🌿 {lote.estado_fenologico}
          </div>
        )}
      </div>

      {/* PASO 1: Selección del Objeto de Evaluación */}
      <div>
        <h4 style={{
          margin: '0 0 12px 0',
          fontSize: '0.85rem',
          fontWeight: '700',
          color: 'var(--color-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '22px', height: '22px',
            background: 'var(--color-accent-green)',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            fontWeight: '800',
            color: '#000'
          }}>1</span>
          Seleccionar objeto de evaluación
        </h4>
        <ObjetoSelector
          objetos={objetos}
          objetoSeleccionado={objetoSeleccionado}
          onSelect={onObjetoSelect}
        />
      </div>

      {/* PASO 2: Variables del Protocolo */}
      {objetoSeleccionado && (
        <div>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '0.85rem',
            fontWeight: '700',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '22px', height: '22px',
              background: 'var(--color-accent-green)',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: '800',
              color: '#000'
            }}>2</span>
            Datos de evaluación
            {objetoSeleccionado.protocolo && (
              <span style={{
                fontSize: '0.65rem',
                color: 'var(--color-text-muted)',
                fontWeight: '400',
                marginLeft: '4px'
              }}>
                (Protocolo v{objetoSeleccionado.protocolo.version})
              </span>
            )}
          </h4>

          {objetoSeleccionado.protocolo?.variables?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {objetoSeleccionado.protocolo.variables.map(variable => (
                <VariableInput
                  key={variable.clave}
                  variable={variable}
                  valor={newMonitoreo.valores_evaluacion?.[variable.clave] ?? ''}
                  onChange={onValorChange}
                />
              ))}

              {/* Indicador de incidencia auto-calculada */}
              <IncidenciaIndicator incidenciaPct={incidenciaCalculada} />

              {/* Alertas de umbral en tiempo real */}
              <AlertasUmbral alertas={alertasUmbral} />
            </div>
          ) : (
            <div style={{
              padding: '16px',
              background: 'var(--color-surface-2)',
              borderRadius: '10px',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem'
            }}>
              No hay protocolo de evaluación configurado para este objeto.
              Puedes registrar observaciones generales.
            </div>
          )}

          {/* Campos comunes opcionales */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                Temperatura (°C)
              </label>
              <input
                type="number"
                value={newMonitoreo.temperatura_c ?? ''}
                onChange={e => onFieldChange('temperatura_c', e.target.value)}
                placeholder="25"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                Humedad Relativa (%)
              </label>
              <input
                type="number"
                value={newMonitoreo.humedad_pct ?? ''}
                onChange={e => onFieldChange('humedad_pct', e.target.value)}
                placeholder="75"
                min="0" max="100"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicMonitoringForm;
