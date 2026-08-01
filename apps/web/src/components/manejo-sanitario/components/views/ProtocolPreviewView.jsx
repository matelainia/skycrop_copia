import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Edit3, Copy, Download, Leaf, ChevronRight,
  Activity, Shield, Zap, BarChart2, Clock, Check, Archive,
  XCircle, Info, AlertTriangle, Eye, Calendar, User, Layers,
  RefreshCw
} from 'lucide-react';
import { agronomyRepository } from '../../repositories/agronomyRepository';
import { buildProtocolSummary, buildProtocolEstadoConfig } from '../../domain/buildProtocolSummary';
import { ProtocolValidator } from '../../domain/services/ProtocolValidator.js';

// ─── Helpers de presentación ─────────────────────────────────────────────────

const TIPO_ICONS = {
  'Número': '🔢', 'Decimal': '🔣', 'Texto': '📝', 'Escala': '📊',
  'Booleano': '✅', 'Lista': '📋', 'Imagen': '📷', 'GPS': '📍',
  'Fecha': '📅', 'Hora': '🕐'
};

const NIVEL_COLORS = {
  'Bajo':    { color: '#15803d', bg: 'rgba(21,128,61,0.12)' },
  'Medio':   { color: '#a16207', bg: 'rgba(234,179,8,0.12)' },
  'Alto':    { color: '#c2410c', bg: 'rgba(249,115,22,0.12)' },
  'Crítico': { color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
};

const SectionTitle = ({ icon, label, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--border-color)' }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, color: 'var(--text-primary)' }}>
      {label}
    </h3>
    {count !== undefined && (
      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
        {count}
      </span>
    )}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
    <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 140 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{value || '—'}</span>
  </div>
);

// ─── Sección: Información General ────────────────────────────────────────────
const SeccionInfoGeneral = ({ protocolo, summary }) => {
  const estadoCfg = buildProtocolEstadoConfig(protocolo.estado);
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <SectionTitle icon="📋" label="Información General" />
      <InfoRow label="Nombre" value={summary.nombre} />
      <InfoRow label="Cultivo" value={summary.cultivo} />
      <InfoRow label="Objeto de evaluación" value={summary.objeto} />
      <InfoRow label="Tipo de monitoreo" value={summary.tipoMonitoreo} />
      <InfoRow label="Responsable" value={summary.responsable} />
      <InfoRow label="Versión" value={`v${summary.version}`} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estado</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color }}>
          {estadoCfg.label}
        </span>
      </div>
      {summary.descripcion && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {summary.descripcion}
        </div>
      )}
    </div>
  );
};

// ─── Sección: Diseño de Muestreo ─────────────────────────────────────────────
const SeccionMuestreo = ({ summary }) => (
  <div className="glass-card" style={{ padding: '20px 24px' }}>
    <SectionTitle icon="📊" label="Diseño de Muestreo" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {[
        { label: 'Unidad de muestreo', value: summary.unidadMuestreo },
        { label: 'Tamaño de muestra', value: summary.tamanioMuestra !== '—' ? `${summary.tamanioMuestra} unidades` : '—' },
        { label: 'Frecuencia', value: summary.frecuenciaDias !== '—' ? `Cada ${summary.frecuenciaDias} días` : '—' },
        { label: 'Método de selección', value: summary.metodoSeleccion },
      ].map((item, i) => (
        <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{item.value || '—'}</div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Sección: Variables ───────────────────────────────────────────────────────
const SeccionVariables = ({ variables }) => (
  <div className="glass-card" style={{ padding: '20px 24px' }}>
    <SectionTitle icon="🔬" label="Variables Configuradas" count={variables.length} />
    {variables.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>Sin variables configuradas.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {variables.map((v, i) => (
          <div key={v.id || v.clave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{TIPO_ICONS[v.tipo] || '📝'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {v.etiqueta}
                {v.obligatorio && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {v.unidad && <span>{v.unidad} · </span>}
                <span>{v.tipo}</span>
                {Array.isArray(v.escalas) && v.escalas.length > 0 && <span> · {v.escalas.length} niveles de escala</span>}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: '#1d4ed8', flexShrink: 0 }}>
              #{i + 1}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Sección: Escalas ─────────────────────────────────────────────────────────
const SeccionEscalas = ({ variables }) => {
  const variablesConEscalas = variables.filter(v => Array.isArray(v.escalas) && v.escalas.length > 0);
  if (variablesConEscalas.length === 0) {
    const variablesNumericas = variables.filter(v => ['Número','Decimal','Escala'].includes(v.tipo));
    if (variablesNumericas.length === 0) return null;
    return (
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <SectionTitle icon="🌈" label="Escalas de Color" />
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
          Las escalas de color no han sido configuradas para las variables numéricas de este protocolo.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <SectionTitle icon="🌈" label="Escalas de Color" count={variablesConEscalas.reduce((acc, v) => acc + v.escalas.length, 0)} />
      {variablesConEscalas.map(v => (
        <div key={v.id || v.clave} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            {v.etiqueta} {v.unidad && `(${v.unidad})`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {v.escalas.map((e, i) => {
              const cfg = NIVEL_COLORS[e.nivel] || NIVEL_COLORS['Bajo'];
              const rango = [
                e.min_val !== null && e.min_val !== undefined ? `${e.min_val}` : null,
                e.max_val !== null && e.max_val !== undefined ? `${e.max_val}` : null,
              ].filter(Boolean).join(' – ') || 'Sin rango definido';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, minWidth: 60 }}>{e.nivel}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 99, background: cfg.bg, border: `1px solid ${cfg.color}30` }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80, textAlign: 'right' }}>{rango}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Sección: Umbrales ───────────────────────────────────────────────────────
const SeccionUmbrales = ({ umbrales, variables }) => {
  const etiquetaMap = Object.fromEntries((variables || []).map(v => [v.clave, v.etiqueta]));
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <SectionTitle icon="⚠️" label="Umbrales de Alerta" count={umbrales.length} />
      {umbrales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>Sin umbrales configurados.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {umbrales.map((u, i) => {
            const cfg = NIVEL_COLORS[u.nivel_riesgo] || NIVEL_COLORS['Medio'];
            return (
              <div key={u.id || i} style={{ padding: '12px 16px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: '0.05em' }}>SI</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {etiquetaMap[u.variable_clave] || u.variable_clave}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--bg-card)', padding: '1px 8px', borderRadius: 6 }}>
                  {u.operador}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.valor}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: '0.05em', marginLeft: 4 }}>→</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'var(--bg-app)', color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                  Nivel {u.nivel_riesgo}
                </span>
                {u.mensaje && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', flexBasis: '100%', paddingLeft: 4 }}>
                    {u.mensaje}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Sección: Reglas Automáticas ─────────────────────────────────────────────
const SeccionReglas = ({ reglas, variables }) => {
  const etiquetaMap = Object.fromEntries((variables || []).map(v => [v.clave, v.etiqueta]));
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <SectionTitle icon="⚡" label="Reglas Automáticas" count={reglas.length} />
      {reglas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>Sin reglas automáticas configuradas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reglas.map((r, i) => (
            <div key={r.id || i} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.05em', background: 'rgba(139,92,246,0.1)', padding: '2px 10px', borderRadius: 20 }}>SI</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {etiquetaMap[r.variable_clave] || r.variable_clave}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--bg-card)', padding: '1px 8px', borderRadius: 6 }}>
                  {r.operador}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{r.valor}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.05em', background: 'rgba(139,92,246,0.1)', padding: '2px 10px', borderRadius: 20 }}>ENTONCES</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>{r.accion}</span>
                {r.mensaje && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>· {r.mensaje}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sección: Historial ───────────────────────────────────────────────────────
const SeccionHistorial = ({ protocolo, historial, summary }) => (
  <div className="glass-card" style={{ padding: '20px 24px' }}>
    <SectionTitle icon="📜" label="Historial y Auditoría" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
      {[
        { label: 'Fecha de creación', value: summary.creadoEn, icon: <Calendar size={13} /> },
        { label: 'Última modificación', value: summary.actualizadoEn, icon: <Clock size={13} /> },
        { label: 'Creado por', value: summary.createdBy, icon: <User size={13} /> },
        { label: 'Versión activa', value: `v${summary.version}`, icon: <Layers size={13} /> },
      ].map((item, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
            {item.icon} {item.label}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
        </div>
      ))}
    </div>
    {summary.auditComentario && (
      <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
        <strong>Comentario de auditoría:</strong> {summary.auditComentario}
      </div>
    )}
    {historial && historial.length > 1 && (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Versiones anteriores</div>
        {historial.slice(1).map((v, i) => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>v{v.version}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{v.created_by || 'Sistema'}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-muted)', display: 'inline-block' }}>{v.estado}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ProtocolPreviewView({
  protocolo: initialProtocolo,
  onBack,
  onEdit,
  onClone,
  onExport,
  userId,
}) {
  const [protocolo, setProtocolo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Cargar el protocolo completo desde la API (con variables + escalas + umbrales + reglas)
    const loadCompleto = async () => {
      try {
        const completo = await agronomyRepository.getProtocoloCompleto(initialProtocolo.id);
        if (!cancelled) {
          setProtocolo(completo);
          // Cargar historial si hay objeto de evaluación
          const objetoId = completo.objeto_evaluacion?.id || completo.objeto_evaluacion_id;
          if (objetoId) {
            const hist = await agronomyRepository.getHistorialVersiones(
              objetoId,
              completo.cultivo?.id || completo.cultivo_id
            ).catch(() => []);
            if (!cancelled) setHistorial(hist);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCompleto();
    return () => { cancelled = true; };
  }, [initialProtocolo.id]);

  const handlePublish = async () => {
    try {
      setLoading(true);

      // ── Validar antes de publicar ───────────────────────────────
      const { valido, errores } = ProtocolValidator.validate(protocolo);
      if (!valido) {
        alert(
          `❌ El protocolo no puede publicarse. Corrija los siguientes errores:\n\n` +
          errores.map(e => `• ${e}`).join('\n')
        );
        setLoading(false);
        return;
      }

      await agronomyRepository.publicarProtocolo(protocolo.id, userId);
      const actualizado = await agronomyRepository.getProtocoloCompleto(protocolo.id);
      setProtocolo(actualizado);
      alert('✅ Protocolo activado y publicado exitosamente.');
    } catch (err) {
      alert('Error al activar protocolo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!protocolo) return;
    const json = JSON.stringify(protocolo, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `protocolo_${protocolo.nombre || protocolo.id}_v${protocolo.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (onExport) onExport(protocolo);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando protocolo completo...</div>
        </div>
      </div>
    );
  }

  if (error || !protocolo) {
    return (
      <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>Error al cargar el protocolo</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{error}</div>
        <button onClick={onBack} style={{ marginTop: 16, padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          ← Volver al listado
        </button>
      </div>
    );
  }

  const summary    = buildProtocolSummary(protocolo);
  const estadoCfg  = buildProtocolEstadoConfig(protocolo.estado);
  const variables  = protocolo.variables || [];
  const umbrales   = protocolo.umbrales  || [];
  const reglas     = protocolo.reglas    || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <Leaf size={12} style={{ color: 'var(--primary)' }} />
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Protocolos</span>
            <ChevronRight size={10} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Vista Previa</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              {summary.nombre}
            </h1>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color }}>
              {estadoCfg.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              v{summary.version}
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.cultivo && <span>{summary.cultivo} · </span>}
            {summary.objeto && <span>{summary.objeto}</span>}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.15s' }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
          <button
            onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.15s' }}
          >
            <Download size={14} /> Exportar JSON
          </button>
          {onClone && (
            <button
              onClick={() => onClone(protocolo)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.15s' }}
            >
              <Copy size={14} /> Clonar
            </button>
          )}
          {protocolo.estado === 'borrador' && (
            <button
              onClick={handlePublish}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#16a34a', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'white', boxShadow: '0 4px 16px -4px rgba(22,163,74,0.4)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.transform = 'none'; }}
            >
              <Check size={14} /> Activar Protocolo
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(protocolo)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.2s ease' }}
            >
              <Edit3 size={14} /> Editar Protocolo
            </button>
          )}
        </div>
      </div>

      {/* ── Banner solo lectura ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', fontSize: 12, color: '#1d4ed8' }}>
        <Eye size={14} style={{ flexShrink: 0 }} />
        <span><strong>Vista de solo lectura.</strong> Para realizar cambios, haz clic en "Editar Protocolo".</span>
        {protocolo.estado === 'activo' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#a16207', background: 'rgba(234,179,8,0.1)', padding: '2px 10px', borderRadius: 20, border: '1px solid rgba(234,179,8,0.3)', fontWeight: 700, flexShrink: 0 }}>
            ⚠ Editar creará una nueva versión
          </span>
        )}
      </div>

      {/* ── KPI Chips ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { icon: <Activity size={15} />, val: summary.numVariables, label: 'Variables',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { icon: <Shield   size={15} />, val: summary.numUmbrales,  label: 'Umbrales',   color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
          { icon: <Zap      size={15} />, val: summary.numReglas,    label: 'Reglas',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
          { icon: <BarChart2 size={15} />, val: `${summary.tamanioMuestra} ${summary.unidadMuestreo}`, label: summary.frecuenciaDias !== '—' ? `c/${summary.frecuenciaDias}d` : 'Muestra', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        ].map((kpi, i) => (
          <div key={i} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color, flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Secciones de Detalle ────────────────────────────────────────────── */}
      <SeccionInfoGeneral protocolo={protocolo} summary={summary} />
      <SeccionMuestreo summary={summary} />
      {variables.length > 0 && <SeccionVariables variables={variables} />}
      {variables.length > 0 && <SeccionEscalas variables={variables} />}
      {umbrales.length > 0 && <SeccionUmbrales umbrales={umbrales} variables={variables} />}
      {reglas.length > 0 && <SeccionReglas reglas={reglas} variables={variables} />}
      <SeccionHistorial protocolo={protocolo} historial={historial} summary={summary} />
    </div>
  );
}
