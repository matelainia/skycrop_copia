import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Save, Send, ChevronRight, Leaf,
  Plus, Trash2, GripVertical, Check, Eye, X, Copy,
  Info, AlertTriangle, Zap, Shield, Activity, Settings, FlaskConical, Calculator
} from 'lucide-react';
import { agronomyRepository } from '../../repositories/agronomyRepository';
import { Paso4Indicadores, ESTRATEGIAS_CATALOGO } from './StepIndicators.jsx';
import { ProtocolValidator } from '../../domain/services/ProtocolValidator.js';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────────────

const PASOS = [
  { id: 1, label: 'Información General', icon: Info },
  { id: 2, label: 'Diseño de Muestreo', icon: Settings },
  { id: 3, label: 'Variables', icon: Activity },
  { id: 4, label: 'Indicadores', icon: FlaskConical },
  { id: 5, label: 'Escalas', icon: Shield },
  { id: 6, label: 'Umbrales y Reglas', icon: Zap },
  { id: 7, label: 'Vista Previa', icon: Eye },
  { id: 8, label: 'Publicar', icon: Send },
];

const UNIDADES_MUESTREO = [
  { id: 'Árbol', emoji: '🌳' },
  { id: 'Planta', emoji: '🌿' },
  { id: 'Hoja', emoji: '🍃' },
  { id: 'Fruto', emoji: '🍎' },
  { id: 'Rama', emoji: '🌾' },
  { id: 'Mazorca', emoji: '🌽' },
  { id: 'Racimo', emoji: '🍇' },
  { id: 'Flor', emoji: '🌸' },
  { id: 'Metro lineal', emoji: '📏' },
  { id: 'Parcela', emoji: '🗺️' },
  { id: 'Otro', emoji: '🔹' },
];

const METODOS_SELECCION = ['Aleatorio simple', 'Aleatorio sistemático', 'Dirigido', 'Estratificado'];

const FRECUENCIAS = [
  { label: 'Diario', dias: 1 },
  { label: 'Semanal', dias: 7 },
  { label: 'Cada 15 días', dias: 15 },
  { label: 'Mensual', dias: 30 },
];

const TIPOS_VARIABLE = ['Número', 'Decimal', 'Texto', 'Fecha', 'Hora', 'Lista', 'Escala', 'Imagen', 'GPS', 'Booleano'];
const COLORES_NIVEL = [
  { nivel: 'Bajo', color: '#15803d', bg: 'rgba(21,128,61,0.12)' },
  { nivel: 'Medio', color: '#a16207', bg: 'rgba(234,179,8,0.12)' },
  { nivel: 'Alto', color: '#c2410c', bg: 'rgba(249,115,22,0.12)' },
  { nivel: 'Crítico', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
];

const ACCIONES_REGLA = ['Crear alerta', 'Crear tarea', 'Enviar notificación', 'Recomendar intervención', 'Cambiar estado del lote', 'Registrar incidencia'];
const OPERADORES = ['>', '<', '>=', '<=', '=', '!='];
const ESTADOS_PROTOCOLO = ['borrador', 'activo'];

// ──────────────────────────────────────────────────────────────────────────────
// Stepper horizontal
// ──────────────────────────────────────────────────────────────────────────────

const Stepper = ({ paso, total }) => (
  <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 2 }}>
    {PASOS.map((p, i) => {
      const done = paso > p.id;
      const current = paso === p.id;
      const Icon = p.icon;
      return (
        <React.Fragment key={p.id}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80, flex: 1 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? 'var(--primary)' : current ? 'rgba(21,128,61,0.15)' : 'var(--bg-card)',
              border: current ? '2px solid var(--primary)' : done ? 'none' : '2px solid var(--border-color)',
              color: done ? 'white' : current ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'all 0.25s ease', flexShrink: 0
            }}>
              {done ? <Check size={14} /> : <Icon size={14} />}
            </div>
            <span style={{
              fontSize: 10, fontWeight: current || done ? 700 : 400, textAlign: 'center', lineHeight: 1.3,
              color: done ? 'var(--primary)' : current ? 'var(--text-primary)' : 'var(--text-muted)'
            }}>{p.label}</span>
          </div>
          {i < PASOS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: done ? 'var(--primary)' : 'var(--border-color)', marginTop: 16, transition: 'background 0.25s', minWidth: 16, maxWidth: 40, alignSelf: 'flex-start' }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Panel lateral dinámico
// ──────────────────────────────────────────────────────────────────────────────

const ProtocolSidebar = ({ form, historial, paso, onGuardarBorrador, saving }) => {
  const vars = (form.variables || []).length;
  const umbs = (form.umbrales || []).length;
  const regls = (form.reglas || []).length;

  return (
    <aside style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14
    }}>
      {/* Resumen del protocolo */}
      <div className="glass-card" style={{ padding: '18px 20px' }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 14, margin: '0 0 14px 0' }}>
          Resumen del Protocolo
        </h4>

        {form.objeto_nombre && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(21,128,61,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔬</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{form.objeto_nombre}</div>
              {form.objeto_cientifico && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{form.objeto_cientifico}</div>}
              {form.estado && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(21,128,61,0.1)', color: 'var(--primary)', display: 'inline-block', marginTop: 4 }}>
                  {form.estado === 'activo' ? '● Activo' : '○ ' + (form.estado || 'Borrador')}
                </span>
              )}
            </div>
          </div>
        )}

        {[
          { label: 'Cultivo', val: form.cultivo_nombre || '—' },
          { label: 'Tipo', val: form.tipo_monitoreo || '—' },
          { label: 'Versión', val: form.version || '1.0' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
            <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.val}</span>
          </div>
        ))}

        <div style={{ height: 1, background: 'var(--border-color)', margin: '10px 0' }} />

        {/* Diseño de muestreo */}
        {form.unidad_muestreo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8, color: 'var(--text-primary)' }}>
            <span>📊</span>
            <span><strong>{form.tamanio_muestra || '?'}</strong> {form.unidad_muestreo} cada {form.frecuencia_dias || '?'} días</span>
          </div>
        )}

        {/* Contadores */}
        {[
          { icon: Activity, val: vars, label: 'variables configuradas', color: '#3b82f6' },
          { icon: Shield, val: umbs, label: 'umbrales de alerta', color: '#f97316' },
          { icon: Zap, val: regls, label: 'reglas automáticas', color: '#8b5cf6' },
        ].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 7 }}>
              <Icon size={13} style={{ color: m.color }} />
              <span><strong style={{ color: 'var(--text-primary)' }}>{m.val}</strong> <span style={{ color: 'var(--text-muted)' }}>{m.label}</span></span>
            </div>
          );
        })}
      </div>

      {/* Historial de versiones */}
      {historial && historial.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 18px' }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
            Versiones
          </h4>
          {historial.slice(0, 4).map((v, i) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < Math.min(historial.length, 4) - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 12, color: i === 0 ? 'var(--primary)' : 'var(--text-primary)' }}>v{v.version}</span>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v.created_by || 'Sistema'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: v.estado === 'activo' ? 'rgba(21,128,61,0.1)' : 'var(--bg-card)',
                  color: v.estado === 'activo' ? 'var(--primary)' : 'var(--text-muted)'
                }}>
                  {v.estado}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>
          Acciones rápidas
        </h4>
        <button
          onClick={onGuardarBorrador}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-app)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', transition: 'all 0.15s' }}
        >
          <Save size={13} /> {saving ? 'Guardando...' : 'Guardar borrador'}
        </button>
      </div>
    </aside>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Paso 1: Información General
// ──────────────────────────────────────────────────────────────────────────────

const Paso1 = ({ form, setField, cultivos, objetos, estadosFenologicos, onCultivoChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
        Nombre del protocolo <span style={{ color: '#dc2626' }}>*</span>
      </label>
      <input
        value={form.nombre || ''}
        onChange={e => setField('nombre', e.target.value)}
        placeholder="Ej: Monilia - Protocolo Interno v1"
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
      />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cultivo <span style={{ color: '#dc2626' }}>*</span></label>
        <select value={form.cultivo_id || ''} onChange={e => { setField('cultivo_id', e.target.value); onCultivoChange(e.target.value, cultivos); }}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <option value="">Seleccionar cultivo...</option>
          {cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre_comun}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tipo de monitoreo</label>
        <select value={form.tipo_monitoreo || ''} onChange={e => setField('tipo_monitoreo', e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <option value="">Seleccionar tipo...</option>
          {['Sanitario (Fitosanitario)', 'Productivo', 'Preventivo', 'Seguimiento', 'Investigación'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Objeto de evaluación <span style={{ color: '#dc2626' }}>*</span></label>
        <input
          list="objetos-evaluacion-list"
          value={form.objeto_nombre || ''}
          onChange={e => {
            const val = e.target.value;
            setField('objeto_nombre', val);
            const match = objetos.find(o => o.nombre_comun?.toLowerCase() === val.trim().toLowerCase());
            if (match) {
              setField('objeto_evaluacion_id', match.id);
              setField('objeto_cientifico', match.nombre_cientifico || '');
            } else {
              setField('objeto_evaluacion_id', '');
              setField('objeto_cientifico', '');
            }
          }}
          placeholder="Escriba o seleccione un objeto (ej: Monilia, Roya, Trips...)"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
        />
        <datalist id="objetos-evaluacion-list">
          {objetos.map(o => <option key={o.id} value={o.nombre_comun}>{o.categoria ? `(${o.categoria})` : ''}</option>)}
        </datalist>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Estado del protocolo</label>
        <select value={form.estado || 'borrador'} onChange={e => setField('estado', e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          {ESTADOS_PROTOCOLO.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Versión</label>
        <input value={form.version || '1.0'} onChange={e => setField('version', e.target.value)}
          placeholder="1.0"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Responsable</label>
        <input value={form.responsable || ''} onChange={e => setField('responsable', e.target.value)}
          placeholder="Nombre del responsable técnico"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
      </div>
    </div>

    <div>
      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Descripción</label>
      <textarea value={form.descripcion || ''} onChange={e => setField('descripcion', e.target.value)}
        placeholder="Describe el objetivo y el alcance de este protocolo de evaluación..."
        rows={3}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', boxSizing: 'border-box' }} />
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Paso 2: Diseño de Muestreo
// ──────────────────────────────────────────────────────────────────────────────

const Paso2 = ({ form, setField, estadosFenologicos }) => {
  const isPresetUnit = UNIDADES_MUESTREO.some(u => u.id === form.unidad_muestreo && u.id !== 'Otro');
  const isOtro = form.unidad_muestreo === 'Otro' || (!isPresetUnit && !!form.unidad_muestreo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Unidad de muestreo */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12 }}>Unidad de muestreo</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {UNIDADES_MUESTREO.map(u => {
            const isSelected = u.id === 'Otro' ? isOtro : form.unidad_muestreo === u.id;
            return (
              <button key={u.id} type="button" onClick={() => {
                if (u.id === 'Otro') {
                  setField('unidad_muestreo', form.unidad_muestreo_custom || 'Otro');
                } else {
                  setField('unidad_muestreo', u.id);
                  setField('unidad_muestreo_custom', '');
                }
              }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '12px 14px', borderRadius: 12, border: '2px solid', cursor: 'pointer',
                  minWidth: 70, transition: 'all 0.15s',
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                  background: isSelected ? 'rgba(21,128,61,0.1)' : 'var(--bg-card)',
                  color: isSelected ? 'var(--primary)' : 'var(--text-muted)'
                }}>
                <span style={{ fontSize: 22 }}>{u.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{u.id}</span>
              </button>
            );
          })}
        </div>
        {isOtro && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>
              Especificar otra unidad de muestreo:
            </label>
            <input
              type="text"
              value={form.unidad_muestreo_custom ?? (form.unidad_muestreo === 'Otro' ? '' : form.unidad_muestreo || '')}
              onChange={e => {
                const val = e.target.value;
                setField('unidad_muestreo_custom', val);
                setField('unidad_muestreo', val || 'Otro');
              }}
              placeholder="Ej: Trampa, Espiga, Vaso, Caja..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

    {/* Cantidad y unidad de medida */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Número de unidades <span style={{ color: '#dc2626' }}>*</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="number" min="1" value={form.tamanio_muestra || ''}
            onChange={e => setField('tamanio_muestra', parseInt(e.target.value) || null)}
            placeholder="100"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
          {form.unidad_muestreo && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{form.unidad_muestreo}s</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total de unidades a evaluar por lote.</div>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Frecuencia <span style={{ color: '#dc2626' }}>*</span></label>
        <select value={form.frecuencia_dias || ''} onChange={e => setField('frecuencia_dias', parseInt(e.target.value) || null)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <option value="">Seleccionar frecuencia...</option>
          {FRECUENCIAS.map(f => <option key={f.dias} value={f.dias}>{f.label}</option>)}
          <option value="custom">Personalizado...</option>
        </select>
        {form.frecuencia_dias && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Periodicidad recomendada.</div>}
      </div>
    </div>

    {/* Método de selección */}
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Método de selección</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {METODOS_SELECCION.map(m => (
          <button key={m} onClick={() => setField('metodo_seleccion', m)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: '2px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              borderColor: form.metodo_seleccion === m ? 'var(--primary)' : 'var(--border-color)',
              background: form.metodo_seleccion === m ? 'var(--primary)' : 'var(--bg-card)',
              color: form.metodo_seleccion === m ? 'white' : 'var(--text-muted)'
            }}>
            {m}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Método de selección de las unidades.</div>
    </div>

    {/* Estado fenológico */}
    {estadosFenologicos.length > 0 && (
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Época / Estado fenológico (selección múltiple)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {estadosFenologicos.map(ef => {
            const sel = (form.estados_fenologicos_ids || []).includes(ef.id);
            return (
              <button key={ef.id} onClick={() => {
                const current = form.estados_fenologicos_ids || [];
                setField('estados_fenologicos_ids', sel ? current.filter(id => id !== ef.id) : [...current, ef.id]);
              }}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: '2px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  borderColor: sel ? 'var(--primary)' : 'var(--border-color)',
                  background: sel ? 'rgba(21,128,61,0.1)' : 'var(--bg-card)',
                  color: sel ? 'var(--primary)' : 'var(--text-muted)'
                }}>
                {ef.nombre} {sel && '✓'}
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
);
};

// ──────────────────────────────────────────────────────────────────────────────
// Paso 3: Variables
// ──────────────────────────────────────────────────────────────────────────────

const VariableRow = ({ variable, index, onUpdate, onRemove }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 8 }}>
    <GripVertical size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, cursor: 'grab' }} />
    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>

    <input value={variable.etiqueta || ''} onChange={e => onUpdate(index, 'etiqueta', e.target.value)}
      placeholder="Nombre de la variable"
      style={{ flex: 2, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />

    <select value={variable.tipo || 'Número'} onChange={e => onUpdate(index, 'tipo', e.target.value)}
      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
      {TIPOS_VARIABLE.map(t => <option key={t} value={t}>{t}</option>)}
    </select>

    <input value={variable.unidad || ''} onChange={e => onUpdate(index, 'unidad', e.target.value)}
      placeholder="Unidad (ej: %)"
      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />

    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
      <input type="checkbox" checked={!!variable.obligatorio} onChange={e => onUpdate(index, 'obligatorio', e.target.checked)}
        style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
      Obligatoria
    </label>

    <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#dc2626', flexShrink: 0 }}>
      <Trash2 size={14} />
    </button>
  </div>
);

const Paso3 = ({ form, setField }) => {
  const variables = form.variables || [];

  const addVar = () => setField('variables', [...variables, {
    id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    clave: `var_${Date.now()}`, etiqueta: '', tipo: 'Número', unidad: '', obligatorio: false, escala: null
  }]);

  const updateVar = (i, key, val) => {
    const next = [...variables];
    next[i] = { ...next[i], [key]: val };
    if (key === 'etiqueta') next[i].clave = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setField('variables', next);
  };

  const removeVar = (i) => setField('variables', variables.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Construye el formulario agregando las variables que los evaluadores registrarán en campo.
        </p>
        <button onClick={addVar}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={13} /> Agregar variable
        </button>
      </div>

      {variables.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 12, color: 'var(--text-muted)' }}>
          <Activity size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 13 }}>Sin variables. Agrega la primera variable del formulario.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '22px 22px 2fr 1fr 1fr 100px 28px', gap: 10, padding: '0 14px', marginBottom: 4 }}>
            {['', '#', 'Variable', 'Tipo', 'Unidad', 'Obligatoria', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {variables.map((v, i) => (
            <VariableRow key={v.id || `var_row_${i}`} variable={v} index={i} onUpdate={updateVar} onRemove={removeVar} />
          ))}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Paso 5: Escalas por Indicador
// ──────────────────────────────────────────────────────────────────────────────

const Paso5Escalas = ({ form, setField }) => {
  const indicadores = form.indicadores || [];

  const updateEscalasIndicador = (indicadorIdx, escalas) => {
    const next = [...indicadores];
    next[indicadorIdx] = { ...next[indicadorIdx], escalas };
    setField('indicadores', next);
  };

  if (indicadores.length === 0) return (
    <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 12, color: 'var(--text-muted)' }}>
      <Shield size={36} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
      <p style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 700 }}>Sin indicadores definidos</p>
      <p style={{ margin: 0, fontSize: 12 }}>Ve al paso anterior para configurar los indicadores del protocolo.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
        Define los rangos de clasificación para cada indicador. Las escalas interpretan el <strong>valor calculado del indicador</strong>, no los datos crudos de campo.
      </p>

      {indicadores.map((indicador, indIdx) => {
        const estrategiaCfg = ESTRATEGIAS_CATALOGO.find(e => e.tipo === indicador.estrategia_tipo) || ESTRATEGIAS_CATALOGO[0];
        const escalas = indicador.escalas || COLORES_NIVEL.map(c => ({ ...c, min: '', max: '' }));

        const updateEscala = (escIdx, campo, valor) => {
          const nextEscalas = [...escalas];
          nextEscalas[escIdx] = { ...nextEscalas[escIdx], [campo]: valor };
          updateEscalasIndicador(indIdx, nextEscalas);
        };

        return (
          <div key={indicador.id || `ind_${indIdx}`} className="glass-card" style={{ padding: '20px 22px' }}>
            {/* Header del indicador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${estrategiaCfg.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {estrategiaCfg.icono}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {indicador.nombre || 'Sin nombre'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Estrategia: <span style={{ color: estrategiaCfg.color, fontWeight: 600 }}>{estrategiaCfg.label}</span>
                </div>
              </div>
              {/* Unidad del indicador */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>Unidad</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: estrategiaCfg.color }}>
                  {indicador.unidad ||
                   indicador.configuracion?.unidad_salida ||
                   (indicador.estrategia_tipo === 'porcentaje' ? '%' : 'Valor')}
                </div>
              </div>
            </div>

            {/* Rangos de escala */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {escalas.map((nivel, escIdx) => (
                <div key={escIdx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: nivel.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 60, color: nivel.color }}>{nivel.nivel}</span>
                  <input type="number" placeholder="Mínimo"
                    value={nivel.min ?? nivel.min_val ?? ''}
                    onChange={e => updateEscala(escIdx, 'min', e.target.value)}
                    style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>–</span>
                  <input type="number" placeholder="Máximo"
                    value={nivel.max ?? nivel.max_val ?? ''}
                    onChange={e => updateEscala(escIdx, 'max', e.target.value)}
                    style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
                  <div style={{ flex: 1, height: 8, borderRadius: 99, background: nivel.bg, border: `1px solid ${nivel.color}40`, minWidth: 40 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>
                    {indicador.unidad || indicador.configuracion?.unidad_salida || (indicador.estrategia_tipo === 'porcentaje' ? '%' : '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};



// ──────────────────────────────────────────────────────────────────────────────
// Paso 6: Umbrales y Reglas (sobre indicadores)
// ──────────────────────────────────────────────────────────────────────────────

const Paso6UmbralesReglas = ({ form, setField }) => {
  const indicadores = form.indicadores || [];
  const variables   = form.variables   || [];
  const umbrales = form.umbrales || [];
  const reglas = form.reglas || [];

  // Prioriza indicadores como referencia de reglas; fallback a variables si no hay indicadores
  const opciones = indicadores.length > 0
    ? indicadores.map(ind => ({ clave: ind.clave, label: `${ind.nombre || ind.clave} (${ind.unidad || ind.estrategia_tipo})` }))
    : variables.map(v => ({ clave: v.clave, label: v.etiqueta || v.clave }));

  const addUmbral = () => setField('umbrales', [...umbrales, { variable_clave: '', operador: '>', valor: '', nivel_riesgo: 'Medio', mensaje: '' }]);
  const updUmbral = (i, k, v) => { const next = [...umbrales]; next[i] = { ...next[i], [k]: v }; setField('umbrales', next); };
  const delUmbral = (i) => setField('umbrales', umbrales.filter((_, idx) => idx !== i));

  const addRegla = () => setField('reglas', [...reglas, { variable_clave: '', operador: '>', valor: '', accion: 'Crear alerta', mensaje: '' }]);
  const updRegla = (i, k, v) => { const next = [...reglas]; next[i] = { ...next[i], [k]: v }; setField('reglas', next); };
  const delRegla = (i) => setField('reglas', reglas.filter((_, idx) => idx !== i));

  const varOptions = opciones.map(o => <option key={o.clave} value={o.clave}>{o.label}</option>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Umbrales */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>⚠ Umbrales de Alerta</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 0 }}>Define los rangos que activarán alertas en las evaluaciones.</p>
          </div>
          <button onClick={addUmbral} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, background: '#f97316', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={12} /> Agregar umbral
          </button>
        </div>
        {umbrales.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)' }}>Sin umbrales configurados.</div>
        ) : umbrales.map((u, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>SI</span>
            <select value={u.variable_clave} onChange={e => updUmbral(i, 'variable_clave', e.target.value)}
              style={{ flex: 2, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
              <option value="">Variable...</option>{varOptions}
            </select>
            <select value={u.operador} onChange={e => updUmbral(i, 'operador', e.target.value)}
              style={{ width: 60, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
              {OPERADORES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input type="number" value={u.valor} onChange={e => updUmbral(i, 'valor', e.target.value)} placeholder="Valor"
              style={{ width: 80, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
            <select value={u.nivel_riesgo} onChange={e => updUmbral(i, 'nivel_riesgo', e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
              {COLORES_NIVEL.map(c => <option key={c.nivel} value={c.nivel}>{c.nivel}</option>)}
            </select>
            <button onClick={() => delUmbral(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {/* Reglas */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>⚡ Reglas Automáticas</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 0 }}>Construye automatizaciones sin escribir código.</p>
          </div>
          <button onClick={addRegla} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, background: '#8b5cf6', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={12} /> Agregar regla
          </button>
        </div>
        {reglas.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)' }}>Sin reglas configuradas.</div>
        ) : reglas.map((r, i) => (
          <div key={i} style={{ padding: '12px 14px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.05em' }}>SI</span>
              <select value={r.variable_clave} onChange={e => updRegla(i, 'variable_clave', e.target.value)}
                style={{ flex: 2, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                <option value="">Variable...</option>{varOptions}
              </select>
              <select value={r.operador} onChange={e => updRegla(i, 'operador', e.target.value)}
                style={{ width: 60, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                {OPERADORES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input type="text" value={r.valor} onChange={e => updRegla(i, 'valor', e.target.value)} placeholder="Valor"
                style={{ width: 80, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
              <button onClick={() => delRegla(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={13} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.05em', minWidth: 22 }}>→</span>
              <select value={r.accion} onChange={e => updRegla(i, 'accion', e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                {ACCIONES_REGLA.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input value={r.mensaje || ''} onChange={e => updRegla(i, 'mensaje', e.target.value)} placeholder="Mensaje de la acción (opcional)"
                style={{ flex: 2, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-app)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Paso 7: Vista Previa del Formulario
// ──────────────────────────────────────────────────────────────────────────────

const Paso7 = ({ form }) => {
  const [previewValues, setPreviewValues] = useState({});
  const variables = form.variables || [];

  const renderInput = (variable) => {
    const val = previewValues[variable.clave] || '';
    const set = (v) => setPreviewValues(p => ({ ...p, [variable.clave]: v }));

    const baseStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', boxSizing: 'border-box' };

    switch (variable.tipo) {
      case 'Número':
      case 'Decimal':
        return <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={variable.unidad || '0'} style={baseStyle} />;
      case 'Booleano':
        return (
          <div style={{ display: 'flex', gap: 10 }}>
            {['Sí', 'No'].map(opt => (
              <button key={opt} onClick={() => set(opt)}
                style={{
                  flex: 1, padding: '9px', borderRadius: 10, border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  borderColor: val === opt ? 'var(--primary)' : 'var(--border-color)',
                  background: val === opt ? 'var(--primary)' : 'var(--bg-card)',
                  color: val === opt ? 'white' : 'var(--text-muted)'
                }}>{opt}</button>
            ))}
          </div>
        );
      case 'Texto':
        return <textarea value={val} onChange={e => set(e.target.value)} placeholder="Ingrese observaciones..." rows={2} style={{ ...baseStyle, resize: 'vertical' }} />;
      case 'Lista':
        return (
          <select value={val} onChange={e => set(e.target.value)} style={{ ...baseStyle, cursor: 'pointer' }}>
            <option value="">Seleccionar...</option>
            {(variable.opciones || ['Opción 1', 'Opción 2', 'Opción 3']).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'Escala': {
        const opciones = variable.escala || ['0 - Ausente', '1 - Leve', '2 - Moderado', '3 - Grave', '4 - Muy grave'];
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {opciones.map(o => (
              <button key={o} onClick={() => set(o)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.1s',
                  borderColor: val === o ? 'var(--primary)' : 'var(--border-color)',
                  background: val === o ? 'var(--primary)' : 'var(--bg-card)',
                  color: val === o ? 'white' : 'var(--text-muted)'
                }}>{o}</button>
            ))}
          </div>
        );
      }
      case 'Imagen':
        return <div style={{ border: '2px dashed var(--border-color)', borderRadius: 10, padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>📷 Adjuntar fotografía</div>;
      case 'GPS':
        return <div style={{ border: '2px dashed var(--border-color)', borderRadius: 10, padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>📍 Obtener ubicación GPS</div>;
      default:
        return <input value={val} onChange={e => set(e.target.value)} style={baseStyle} />;
    }
  };

  return (
    <div>
      {/* Aviso */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 20 }}>
        <Eye size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#1d4ed8', margin: 0, lineHeight: 1.5 }}>
          <strong>Vista previa interactiva.</strong> Así verán el formulario los evaluadores en campo. Puedes interactuar con él para validar la experiencia sin crear una evaluación real.
        </p>
      </div>

      {/* Formulario preview */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
              {form.nombre || 'Protocolo sin nombre'}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {form.objeto_nombre} · {form.tamanio_muestra || '?'} {form.unidad_muestreo || 'unidades'} · v{form.version || '1.0'}
            </div>
          </div>
          <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: 'rgba(21,128,61,0.1)', color: 'var(--primary)', fontWeight: 700 }}>
            FORMULARIO GENERADO DINÁMICAMENTE
          </span>
        </div>

        {variables.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
            Sin variables definidas. Agrega variables en el Paso 3.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {variables.map(v => (
              <div key={v.clave}>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 7 }}>
                  {v.etiqueta || v.clave}
                  {v.unidad && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 5 }}>({v.unidad})</span>}
                  {v.obligatorio && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, background: 'var(--bg-card)', padding: '1px 7px', borderRadius: 8, border: '1px solid var(--border-color)' }}>{v.tipo}</span>
                </label>
                {renderInput(v)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Paso 8: Resumen y Publicar
// ──────────────────────────────────────────────────────────────────────────────

const Paso8 = ({ form, setField, onGuardarBorrador, onPublicar, saving }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    {/* Resumen */}
    <div className="glass-card" style={{ padding: '20px' }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Resumen Final</h4>
      {[
        { label: 'Nombre', val: form.nombre || '—' },
        { label: 'Cultivo', val: form.cultivo_nombre || '—' },
        { label: 'Objeto', val: form.objeto_nombre || '—' },
        { label: 'Tipo de Monitoreo', val: form.tipo_monitoreo || '—' },
        { label: 'Versión', val: form.version || '1.0' },
        { label: 'Unidad de Muestreo', val: `${form.tamanio_muestra || '?'} ${form.unidad_muestreo || 'unidades'}` },
        { label: 'Frecuencia', val: form.frecuencia_dias ? `Cada ${form.frecuencia_dias} días` : '—' },
        { label: 'Método', val: form.metodo_seleccion || '—' },
        { label: 'Variables', val: `${(form.variables || []).length} variables` },
        { label: 'Indicadores', val: `${(form.indicadores || []).length} indicadores configurados` },
        { label: 'Umbrales', val: `${(form.umbrales || []).length} umbrales` },
        { label: 'Reglas', val: `${(form.reglas || []).length} reglas automáticas` },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.val}</span>
        </div>
      ))}
    </div>

    {/* Comentario de auditoría */}
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
        Comentario de auditoría
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>(recomendado para trazabilidad y certificaciones)</span>
      </label>
      <textarea
        value={form.audit_comentario || ''}
        onChange={e => setField('audit_comentario', e.target.value)}
        placeholder="Ej: Actualización anual del protocolo basada en resultados de campaña 2025. Se agregó variable de temperatura."
        rows={3}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', boxSizing: 'border-box' }}
      />
    </div>

    {/* Advertencia al publicar */}
    {form.estado !== 'borrador' && (
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
        <AlertTriangle size={16} style={{ color: '#a16207', flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: '#a16207', margin: 0 }}>
          Al publicar este protocolo, la versión activa anterior del mismo objeto de evaluación pasará a estado <strong>Archivado</strong> automáticamente.
        </p>
      </div>
    )}

    {/* Botones */}
    <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
      <button onClick={onGuardarBorrador} disabled={saving}
        style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        <Save size={14} /> {saving ? 'Guardando...' : 'Guardar borrador'}
      </button>
      <button onClick={onPublicar} disabled={saving}
        style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 16px -4px rgba(21,128,61,0.4)' }}>
        <Send size={14} /> {saving ? 'Publicando...' : '✓ Guardar y Activar Protocolo'}
      </button>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Componente Principal del Wizard
// ──────────────────────────────────────────────────────────────────────────────

export default function ProtocolWizardForm({ protocolo, userId, userName, cultivos: initialCultivos = [], onCancel, onSaved }) {
  const [paso, setPaso] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Catálogos
  const [cultivos, setCultivos] = useState(initialCultivos);
  const [objetos, setObjetos] = useState([]);
  const [estadosFenologicos, setEstadosFenologicos] = useState([]);
  const [historial, setHistorial] = useState([]);

  // Formulario (único estado plano)
  const FORM_INIT = {
    nombre: '', cultivo_id: '', cultivo_nombre: '', objeto_evaluacion_id: '',
    objeto_nombre: '', objeto_cientifico: '', tipo_monitoreo: '', version: '1.0',
    estado: 'borrador', responsable: userName, descripcion: '',
    unidad_muestreo: '', tamanio_muestra: null, frecuencia_dias: null,
    metodo_seleccion: '', estados_fenologicos_ids: [],
    variables: [], indicadores: [], escalas_config: {}, umbrales: [], reglas: [],
    audit_comentario: ''
  };

  const [form, setForm] = useState(() => {
    if (!protocolo) return FORM_INIT;
    return {
      ...FORM_INIT,
      ...protocolo,
      cultivo_id: protocolo.cultivo?.id || '',
      cultivo_nombre: protocolo.cultivo?.nombre_comun || '',
      objeto_evaluacion_id: protocolo.objeto_evaluacion?.id || '',
      objeto_nombre: protocolo.objeto_evaluacion?.nombre_comun || '',
      objeto_cientifico: protocolo.objeto_evaluacion?.nombre_cientifico || '',
    };
  });

  const setField = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  // Cargar catálogos iniciales
  useEffect(() => {
    agronomyRepository.getCultivos()
      .then(masterCultivos => {
        const map = new Map();
        (initialCultivos || []).forEach(c => {
          if (c?.nombre_comun) map.set(c.nombre_comun.toLowerCase(), c);
        });
        (masterCultivos || []).forEach(c => {
          if (c?.nombre_comun && !map.has(c.nombre_comun.toLowerCase())) {
            map.set(c.nombre_comun.toLowerCase(), c);
          }
        });
        setCultivos(Array.from(map.values()));
      })
      .catch(() => {
        if (initialCultivos?.length) setCultivos(initialCultivos);
      });

    agronomyRepository.getObjetosEvaluacion()
      .then(data => setObjetos(data))
      .catch(() => { });
  }, [initialCultivos]);

  // Cargar estados fenológicos y objetos al cambiar cultivo
  const handleCultivoChange = useCallback(async (cultivoId, allCultivos) => {
    const list = allCultivos || cultivos;
    const cultivo = list.find(c => c.id === cultivoId || c.nombre_comun === cultivoId);

    if (cultivo) {
      setField('cultivo_nombre', cultivo.nombre_comun);
    } else if (typeof cultivoId === 'string') {
      setField('cultivo_nombre', cultivoId);
    }

    if (!cultivoId) {
      setEstadosFenologicos([]);
      agronomyRepository.getObjetosEvaluacion()
        .then(data => setObjetos(data))
        .catch(() => { });
      return;
    }

    try {
      const isCustomLot = typeof cultivoId === 'string' && cultivoId.startsWith('lot-crop-');
      const validCultivoId = (cultivo?.id && !isCustomLot) ? cultivo.id : null;

      const [ef, objs] = await Promise.all([
        validCultivoId ? agronomyRepository.getEstadosFenologicos(validCultivoId).catch(() => []) : Promise.resolve([]),
        validCultivoId ? agronomyRepository.getObjetosEvaluacion(validCultivoId).catch(() => []) : Promise.resolve([])
      ]);

      setEstadosFenologicos(ef);

      if (objs && objs.length > 0) {
        setObjetos(objs);
      } else {
        const masterObjetos = await agronomyRepository.getObjetosEvaluacion();
        setObjetos(masterObjetos);
      }
    } catch {
      setEstadosFenologicos([]);
    }
  }, [cultivos, setField]);

  // Cargar historial de versiones si editando
  useEffect(() => {
    if (protocolo?.objeto_evaluacion?.id) {
      agronomyRepository.getHistorialVersiones(protocolo.objeto_evaluacion.id, protocolo.cultivo?.id)
        .then(setHistorial)
        .catch(() => { });
    }
  }, [protocolo]);

  // Cargar estados fenológicos del protocolo existente
  useEffect(() => {
    if (form.cultivo_id) handleCultivoChange(form.cultivo_id, cultivos);
  }, []);  // solo al montar

  // ── Guardar borrador ──
  const handleGuardarBorrador = async () => {
    setSaving(true); setError(null);
    try {
      const payload = buildPayload('borrador');
      let saved;
      if (protocolo?.id) {
        saved = await agronomyRepository.updateProtocolo(protocolo.id, { ...payload, updated_by: userId });
      } else {
        saved = await agronomyRepository.saveProtocolo({ ...payload, created_by: userId, updated_by: userId });
      }
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Publicar ──
  const handlePublicar = async () => {
    setSaving(true); setError(null);
    try {
      // ── Validación frontend antes de llamar al API ──────────────────
      const protocoloParaValidar = {
        nombre:      form.nombre,
        variables:   form.variables   || [],
        indicadores: form.indicadores || [],
        umbrales:    form.umbrales    || [],
        reglas:      form.reglas      || [],
        recomendaciones: form.recomendaciones || [],
      };

      const { valido, errores, advertencias } = ProtocolValidator.validate(protocoloParaValidar);

      if (!valido) {
        setError(
          `El protocolo no puede publicarse. Corrija los siguientes errores:\n` +
          errores.map(e => `• ${e}`).join('\n')
        );
        return;
      }

      // Mostrar advertencias en consola (no bloquean, pero informan al desarrollador)
      if (advertencias.length > 0) {
        console.warn('[ProtocolWizard] Advertencias al publicar:', advertencias);
      }

      // ── Llamada al API ────────────────────────────────────
      const payload = buildPayload('activo');
      let saved;
      if (protocolo?.id) {
        saved = await agronomyRepository.updateProtocolo(protocolo.id, { ...payload, updated_by: userId });
      } else {
        saved = await agronomyRepository.saveProtocolo({ ...payload, created_by: userId, updated_by: userId });
      }
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const buildPayload = (estado) => {
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    return {
      nombre: form.nombre,
      objeto_nombre: form.objeto_nombre || null,
      objeto_evaluacion_id: isUuid(form.objeto_evaluacion_id) ? form.objeto_evaluacion_id : null,
      cultivo_id: isUuid(form.cultivo_id) ? form.cultivo_id : null,
      tipo_monitoreo: form.tipo_monitoreo || null,
      version: form.version || '1.0',
      estado,
      responsable: form.responsable,
      descripcion: form.descripcion,
      unidad_muestreo: form.unidad_muestreo || null,
      tamanio_muestra: form.tamanio_muestra || null,
      frecuencia_dias: form.frecuencia_dias || null,
      metodo_seleccion: form.metodo_seleccion || null,
      estados_fenologicos_ids: form.estados_fenologicos_ids || null,
      variables: form.variables || [],
      indicadores: form.indicadores || [],
      umbrales: form.umbrales || [],
      reglas: form.reglas || [],
      audit_comentario: form.audit_comentario || null,
      metodologia: form.descripcion || null,
    };
  };

  const canNext = () => {
    if (paso === 1) return !!form.nombre && !!form.objeto_nombre;
    if (paso === 3) return (form.variables || []).length > 0;
    if (paso === 4) return (form.indicadores || []).length > 0;
    return true;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            <Leaf size={13} style={{ color: 'var(--primary)' }} />
            <span style={{ cursor: 'pointer' }} onClick={onCancel}>Configuración</span>
            <ChevronRight size={10} />
            <span style={{ cursor: 'pointer' }} onClick={onCancel}>Protocolos</span>
            <ChevronRight size={10} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {protocolo ? 'Editar Protocolo' : 'Nuevo Protocolo'}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {protocolo ? 'Editar / Configurar Protocolo' : 'Crear / Editar Protocolo de Evaluación'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
            Cancelar
          </button>
          {paso < 8 && (
            <button
              onClick={() => setPaso(p => Math.min(8, p + 1))}
              disabled={!canNext()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: canNext() ? 'var(--primary)' : 'var(--border-color)', color: 'white', fontSize: 13, fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed' }}>
              Siguiente <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="glass-card" style={{ padding: '18px 24px', marginBottom: 20 }}>
        <Stepper paso={paso} total={PASOS.length} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <X size={14} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={12} /></button>
        </div>
      )}

      {/* Layout: columna principal + sidebar */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Columna principal */}
        <div className="glass-card" style={{ flex: 1, padding: '28px 32px', minWidth: 0 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{PASOS[paso - 1]?.id}. {PASOS[paso - 1]?.label}</h2>
          </div>

          {paso === 1 && <Paso1 form={form} setField={setField} cultivos={cultivos} objetos={objetos} estadosFenologicos={estadosFenologicos} onCultivoChange={handleCultivoChange} />}
          {paso === 2 && <Paso2 form={form} setField={setField} estadosFenologicos={estadosFenologicos} />}
          {paso === 3 && <Paso3 form={form} setField={setField} />}
          {paso === 4 && <Paso4Indicadores form={form} setField={setField} />}
          {paso === 5 && <Paso5Escalas form={form} setField={setField} />}
          {paso === 6 && <Paso6UmbralesReglas form={form} setField={setField} />}
          {paso === 7 && <Paso7 form={form} />}
          {paso === 8 && <Paso8 form={form} setField={setField} onGuardarBorrador={handleGuardarBorrador} onPublicar={handlePublicar} saving={saving} />}

          {/* Footer de navegación */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
            <button onClick={() => setPaso(p => Math.max(1, p - 1))} disabled={paso === 1}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: paso === 1 ? 'not-allowed' : 'pointer', color: paso === 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: paso === 1 ? 0.5 : 1 }}>
              <ArrowLeft size={13} /> Atrás
            </button>
            {paso < 8 ? (
              <button onClick={() => setPaso(p => Math.min(8, p + 1))} disabled={!canNext()}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: canNext() ? 'var(--primary)' : 'var(--border-color)', color: 'white', fontSize: 13, fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed' }}>
                Siguiente <ArrowRight size={13} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Sidebar */}
        <ProtocolSidebar
          form={form}
          historial={historial}
          paso={paso}
          onGuardarBorrador={handleGuardarBorrador}
          saving={saving}
        />
      </div>
    </div>
  );
}
