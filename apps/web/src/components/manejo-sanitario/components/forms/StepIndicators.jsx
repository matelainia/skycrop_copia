import React, { useState } from 'react';
import { Plus, Trash2, FlaskConical, ChevronDown, ChevronRight, Check } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes: Catálogo de Estrategias (espejo del StrategyRegistry del backend)
// El frontend lo replica para construir el formulario dinámico.
// En una versión futura este catálogo puede venir de una API.
// ──────────────────────────────────────────────────────────────────────────────

export const ESTRATEGIAS_CATALOGO = [
  {
    tipo: 'absoluto',
    label: 'Conteo Absoluto',
    icono: '🔢',
    descripcion: 'Usa el valor capturado directamente como indicador. Ideal para conteos donde el número absoluto ya tiene significado propio (focos, trampas con capturas).',
    color: '#6b7280',
    camposConfig: ['variable_fuente'],
  },
  {
    tipo: 'porcentaje',
    label: 'Porcentaje (%)',
    icono: '📊',
    descripcion: 'Calcula (Positivos ÷ Total) × 100. Normaliza respecto al tamaño de muestra. Ideal para incidencia, prevalencia y porcentajes de daño.',
    color: '#3b82f6',
    camposConfig: ['numerador', 'denominador'],
  },
  {
    tipo: 'promedio',
    label: 'Promedio / Densidad',
    icono: '📈',
    descripcion: 'Calcula Total ÷ Unidades Evaluadas. Retorna densidad o valor por unidad (Insectos/planta, Lesiones/hoja, Capturas/trampa).',
    color: '#8b5cf6',
    camposConfig: ['total', 'unidades', 'unidad_salida'],
  },
  {
    tipo: 'indice_ponderado',
    label: 'Índice Ponderado (Severidad)',
    icono: '⚖️',
    descripcion: 'Calcula Σ(Grado × Conteo) ÷ (N × GradoMáx). Para escalas de Horsfall-Barratt, índices de defoliación y severidad visual.',
    color: '#f97316',
    camposConfig: ['grado_max', 'niveles'],
  },
  {
    tipo: 'formula',
    label: 'Fórmula Personalizada',
    icono: '🔬',
    descripcion: 'Define una expresión matemática con aliases de variables. Ideal para fórmulas institucionales o de investigación (ej: AUDPC, compuestos).',
    color: '#10b981',
    camposConfig: ['expresion', 'variables', 'unidad_salida'],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Estilos compartidos
// ──────────────────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1.5px solid var(--border-color)', background: 'var(--bg-app)',
  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4,
  display: 'block',
};

const selectorVarStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1.5px solid var(--border-color)', background: 'var(--bg-app)',
  color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

// ──────────────────────────────────────────────────────────────────────────────
// Selector de Estrategia de Cálculo
// ──────────────────────────────────────────────────────────────────────────────
const StrategySelectorCard = ({ estrategia, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(estrategia.tipo)}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
      borderRadius: 12, border: `2px solid ${selected ? estrategia.color : 'var(--border-color)'}`,
      background: selected ? `${estrategia.color}12` : 'var(--bg-card)',
      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%',
    }}
  >
    <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{estrategia.icono}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: selected ? estrategia.color : 'var(--text-primary)' }}>
          {estrategia.label}
        </span>
        {selected && <Check size={13} color={estrategia.color} />}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        {estrategia.descripcion}
      </p>
    </div>
  </button>
);

// ──────────────────────────────────────────────────────────────────────────────
// Configuración dinámica según estrategia seleccionada
// ──────────────────────────────────────────────────────────────────────────────
const ConfiguracionEstrategia = ({ tipo, config, variables, onChange }) => {
  const varOptions = variables.map(v => (
    <option key={v.clave} value={v.clave}>{v.etiqueta || v.clave}</option>
  ));

  const set = (campo, valor) => onChange({ ...config, [campo]: valor });

  if (tipo === 'absoluto') return (
    <div>
      <label style={labelStyle}>Variable fuente (valor crudo)</label>
      <select value={config.variable_fuente || ''} onChange={e => set('variable_fuente', e.target.value)} style={selectorVarStyle}>
        <option value="">Seleccionar variable...</option>
        {varOptions}
      </select>
    </div>
  );

  if (tipo === 'porcentaje') return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div>
        <label style={labelStyle}>Numerador (casos positivos) *</label>
        <select value={config.numerador || ''} onChange={e => set('numerador', e.target.value)} style={selectorVarStyle}>
          <option value="">Seleccionar variable...</option>
          {varOptions}
        </select>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
          Ej: plantas_enfermas, frutos_afectados
        </p>
      </div>
      <div>
        <label style={labelStyle}>Denominador (total evaluado) *</label>
        <select value={config.denominador || ''} onChange={e => set('denominador', e.target.value)} style={selectorVarStyle}>
          <option value="">Seleccionar variable...</option>
          {varOptions}
        </select>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
          Ej: plantas_evaluadas, frutos_evaluados
        </p>
      </div>
    </div>
  );

  if (tipo === 'promedio') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Total acumulado *</label>
          <select value={config.total || ''} onChange={e => set('total', e.target.value)} style={selectorVarStyle}>
            <option value="">Seleccionar variable...</option>
            {varOptions}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Unidades evaluadas *</label>
          <select value={config.unidades || ''} onChange={e => set('unidades', e.target.value)} style={selectorVarStyle}>
            <option value="">Seleccionar variable...</option>
            {varOptions}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Unidad del indicador resultante</label>
        <input value={config.unidad_salida || ''} onChange={e => set('unidad_salida', e.target.value)}
          placeholder="Ej: Insectos/planta, Lesiones/hoja, Capturas/trampa"
          style={inputStyle} />
      </div>
    </div>
  );

  if (tipo === 'indice_ponderado') {
    const niveles = config.niveles || [];
    const addNivel = () => onChange({ ...config, niveles: [...niveles, { grado: niveles.length, variable: '' }] });
    const updateNivel = (i, campo, val) => {
      const next = [...niveles]; next[i] = { ...next[i], [campo]: val };
      onChange({ ...config, niveles: next });
    };
    const removeNivel = i => onChange({ ...config, niveles: niveles.filter((_, idx) => idx !== i) });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Grado máximo de escala *</label>
            <input type="number" min="1" max="100"
              value={config.grado_max || ''} onChange={e => set('grado_max', Number(e.target.value))}
              placeholder="Ej: 4, 5, 9" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Unidad del indicador</label>
            <input value={config.unidad_salida || ''} onChange={e => set('unidad_salida', e.target.value)}
              placeholder="Ej: Índice de Severidad (0-1)" style={inputStyle} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Niveles de grado y su variable *</label>
            <button type="button" onClick={addNivel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={11} /> Nivel
            </button>
          </div>
          {niveles.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Agrega los niveles de la escala (ej: Grado 0, 1, 2, 3, 4)
            </div>
          ) : niveles.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20 }}>G{n.grado}</span>
              <input type="number" min="0" value={n.grado} onChange={e => updateNivel(i, 'grado', Number(e.target.value))}
                style={{ ...inputStyle, width: 60, flex: 'none' }} placeholder="Grado" />
              <select value={n.variable || ''} onChange={e => updateNivel(i, 'variable', e.target.value)} style={{ ...selectorVarStyle, flex: 1 }}>
                <option value="">Variable para este grado...</option>
                {varOptions}
              </select>
              <button type="button" onClick={() => removeNivel(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tipo === 'formula') {
    const aliasMap = config.variables || {};
    const addAlias = () => {
      const newAlias = `v${Object.keys(aliasMap).length + 1}`;
      onChange({ ...config, variables: { ...aliasMap, [newAlias]: '' } });
    };
    const updateAlias = (oldAlias, newAlias, varClave) => {
      const next = { ...aliasMap };
      if (oldAlias !== newAlias) { delete next[oldAlias]; }
      next[newAlias] = varClave;
      onChange({ ...config, variables: next });
    };
    const removeAlias = (alias) => {
      const next = { ...aliasMap }; delete next[alias]; onChange({ ...config, variables: next });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Expresión matemática *</label>
          <input value={config.expresion || ''} onChange={e => set('expresion', e.target.value)}
            placeholder="Ej: (a / b) * 100  ó  (positivos / evaluados) * 100"
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }} />
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
            Usa los aliases definidos abajo. Operadores: +  -  *  /  ^  ( )
          </p>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Mapeo de aliases a variables *</label>
            <button type="button" onClick={addAlias} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={11} /> Alias
            </button>
          </div>
          {Object.entries(aliasMap).map(([alias, varClave]) => (
            <div key={alias} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input value={alias} onChange={e => updateAlias(alias, e.target.value, varClave)}
                placeholder="alias" style={{ ...inputStyle, width: 80, flex: 'none', fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
              <select value={varClave} onChange={e => updateAlias(alias, alias, e.target.value)} style={{ ...selectorVarStyle, flex: 1 }}>
                <option value="">Seleccionar variable...</option>
                {varOptions}
              </select>
              <button type="button" onClick={() => removeAlias(alias)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div>
          <label style={labelStyle}>Unidad del indicador resultante</label>
          <input value={config.unidad_salida || ''} onChange={e => set('unidad_salida', e.target.value)}
            placeholder="Ej: %, Índice, mm/día" style={inputStyle} />
        </div>
      </div>
    );
  }

  return null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Tarjeta de un Indicador
// ──────────────────────────────────────────────────────────────────────────────
const IndicadorCard = ({ indicador, index, variables, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(index === 0);
  const estrategiaCfg = ESTRATEGIAS_CATALOGO.find(e => e.tipo === indicador.estrategia_tipo) || ESTRATEGIAS_CATALOGO[0];

  return (
    <div style={{
      borderRadius: 12, border: `1.5px solid ${expanded ? estrategiaCfg.color + '60' : 'var(--border-color)'}`,
      background: 'var(--bg-card)', overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer',
          background: expanded ? `${estrategiaCfg.color}08` : 'transparent' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${estrategiaCfg.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {estrategiaCfg.icono}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {indicador.nombre || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            <span style={{ color: estrategiaCfg.color, fontWeight: 600 }}>{estrategiaCfg.label}</span>
            {indicador.unidad && <span> · {indicador.unidad}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: `${estrategiaCfg.color}15`, color: estrategiaCfg.color }}>
            #{index + 1}
          </span>
          <button type="button" onClick={e => { e.stopPropagation(); onRemove(index); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ height: 1, background: 'var(--border-color)', margin: '0 -18px' }} />

          {/* Información del indicador */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nombre del indicador *</label>
              <input value={indicador.nombre || ''} onChange={e => onUpdate(index, 'nombre', e.target.value)}
                placeholder="Ej: Incidencia de Monilia, Índice de Severidad..."
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Unidad del indicador</label>
              <input value={indicador.unidad || ''} onChange={e => onUpdate(index, 'unidad', e.target.value)}
                placeholder="%, Índice, mm/día..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Decimales</label>
              <input type="number" min="0" max="6" value={indicador.decimales ?? 2}
                onChange={e => onUpdate(index, 'decimales', Number(e.target.value))}
                style={inputStyle} />
            </div>
          </div>

          {/* Selector de estrategia */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 10 }}>Estrategia de cálculo *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ESTRATEGIAS_CATALOGO.map(e => (
                <StrategySelectorCard
                  key={e.tipo}
                  estrategia={e}
                  selected={indicador.estrategia_tipo === e.tipo}
                  onSelect={tipo => onUpdate(index, 'estrategia_tipo', tipo)}
                />
              ))}
            </div>
          </div>

          {/* Configuración dinámica de la estrategia */}
          {indicador.estrategia_tipo && (
            <div style={{ padding: '16px', borderRadius: 10, background: `${estrategiaCfg.color}06`,
              border: `1px solid ${estrategiaCfg.color}30` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: estrategiaCfg.color, marginBottom: 12,
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configuración: {estrategiaCfg.label}
              </div>
              <ConfiguracionEstrategia
                tipo={indicador.estrategia_tipo}
                config={indicador.configuracion || {}}
                variables={variables}
                onChange={cfg => onUpdate(index, 'configuracion', cfg)}
              />
            </div>
          )}

          {/* Descripción opcional */}
          <div>
            <label style={labelStyle}>Descripción (opcional)</label>
            <input value={indicador.descripcion || ''} onChange={e => onUpdate(index, 'descripcion', e.target.value)}
              placeholder="Describe el propósito y metodología del indicador..."
              style={inputStyle} />
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Paso 4: Indicadores — Componente principal exportado
// ──────────────────────────────────────────────────────────────────────────────

export const Paso4Indicadores = ({ form, setField }) => {
  const variables  = form.variables  || [];
  const indicadores = form.indicadores || [];

  const addIndicador = () => setField('indicadores', [...indicadores, {
    id: `ind_${Date.now()}`,
    clave: `indicador_${Date.now()}`,
    nombre: '',
    descripcion: '',
    unidad: '',
    decimales: 2,
    estrategia_tipo: 'porcentaje',
    configuracion: {},
    escalas: [],
  }]);

  const updateIndicador = (i, campo, valor) => {
    const next = [...indicadores];
    next[i] = { ...next[i], [campo]: valor };
    if (campo === 'nombre') {
      next[i].clave = `ind_${valor.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 40)}_${i}`;
    }
    setField('indicadores', next);
  };

  const removeIndicador = (i) => setField('indicadores', indicadores.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px 0' }}>
            Define los indicadores agronómicos que este protocolo calculará. Cada indicador combina variables
            de captura mediante una estrategia de cálculo para producir un valor interpretable y normalizado.
          </p>
          {variables.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '8px 12px',
              borderRadius: 8, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', fontSize: 12 }}>
              <span>⚠️</span>
              <span style={{ color: '#a16207' }}>Primero agrega variables de captura en el paso anterior.</span>
            </div>
          )}
        </div>
        <button onClick={addIndicador} disabled={variables.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9,
            background: variables.length === 0 ? 'var(--border-color)' : 'var(--primary)',
            color: 'white', border: 'none', fontSize: 12, fontWeight: 700,
            cursor: variables.length === 0 ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          <Plus size={13} /> Agregar indicador
        </button>
      </div>

      {/* Lista de indicadores */}
      {indicadores.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border-color)',
          borderRadius: 12, color: 'var(--text-muted)' }}>
          <FlaskConical size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 700 }}>Sin indicadores configurados</p>
          <p style={{ margin: 0, fontSize: 12 }}>
            Agrega los indicadores agronómicos que este protocolo debe calcular.
            <br />Ejemplos: <em>Incidencia (%)</em>, <em>Severidad (Índice)</em>, <em>Densidad (Insectos/árbol)</em>.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {indicadores.map((ind, i) => (
            <IndicadorCard
              key={ind.id || `ind_${i}`}
              indicador={ind}
              index={i}
              variables={variables}
              onUpdate={updateIndicador}
              onRemove={removeIndicador}
            />
          ))}
        </div>
      )}

      {/* Ayuda */}
      {indicadores.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.15)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>💡 ¿Cuántos indicadores agregar?</strong><br />
          Un protocolo puede tener múltiples indicadores simultáneos. Ejemplo para <em>Monilia</em>:
          &nbsp;<em>Incidencia (%)</em> + <em>Índice de Severidad</em> + <em>Progreso semanal</em>.
          Cada uno se calculará de forma independiente en cada evaluación de campo.
        </div>
      )}
    </div>
  );
};

export default Paso4Indicadores;
