import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Eye, Copy, Upload, Download,
  Leaf, ChevronRight, Check, Clock, Archive, XCircle,
  Activity, BarChart2, Shield, Zap, MoreVertical, RefreshCw, Trash2
} from 'lucide-react';
import { agronomyRepository } from '../../repositories/agronomyRepository';
import { useAuthContext } from '../../../../context/AuthContext';
import { useLotsContext } from '../../context/LotsContext';
import ProtocolWizardForm from '../forms/ProtocolWizardForm';
import ProtocolPreviewView from './ProtocolPreviewView';
import { buildProtocolSummary } from '../../domain/buildProtocolSummary';
import { ProtocolValidator } from '../../domain/services/ProtocolValidator.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CONFIG = {
  borrador:  { label: 'Borrador',  color: '#a16207', bg: 'rgba(234,179,8,0.12)',  icon: Clock },
  activo:    { label: 'Activo',    color: '#15803d', bg: 'rgba(21,128,61,0.12)',  icon: Check },
  archivado: { label: 'Archivado', color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)',  icon: Archive },
  obsoleto:  { label: 'Obsoleto',  color: '#dc2626', bg: 'rgba(220,38,38,0.12)',  icon: XCircle },
};

const EstadoChip = ({ estado }) => {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.borrador;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em'
    }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

// ─── Tarjeta de Protocolo ─────────────────────────────────────────────────────

const ProtocolCard = ({ protocolo, onEdit, onClone, onExport, onPreview, onDelete, onPublish }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  // Usa buildProtocolSummary para obtener conteos reales (prioriza num_* del servidor)
  const summary = buildProtocolSummary(protocolo);

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px', display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'all 0.2s ease', cursor: 'pointer', position: 'relative',
        borderLeft: `3px solid ${ESTADO_CONFIG[protocolo.estado]?.color || 'var(--border-color)'}`
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover, 0 8px 24px -4px rgba(0,0,0,0.15))'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color: 'var(--text-muted)', textTransform: 'uppercase'
            }}>
              v{protocolo.version}
            </span>
            <EstadoChip estado={protocolo.estado} />
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {protocolo.nombre || protocolo.objeto_evaluacion?.nombre_comun || 'Sin nombre'}
          </h3>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {protocolo.cultivo && (
              <span style={{ fontSize: 11, color: 'var(--primary)', background: 'rgba(21,128,61,0.08)', padding: '1px 7px', borderRadius: 10 }}>
                {protocolo.cultivo.nombre_comun}
              </span>
            )}
            {protocolo.objeto_evaluacion && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                {protocolo.objeto_evaluacion.categoria}
              </span>
            )}
          </div>
        </div>

        {/* Menú contextual */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)', borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', right: 0, top: 28, zIndex: 50,
                background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                borderRadius: 10, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.18)',
                minWidth: 160, overflow: 'hidden'
              }}
            >
              {[
            { icon: Eye,      label: 'Abrir / Ver',      action: () => { setMenuOpen(false); onPreview(protocolo); } },
            protocolo.estado === 'borrador' && {
              icon: Check,    label: 'Activar / Publicar', action: () => { setMenuOpen(false); onPublish(protocolo); }
            },
            { icon: Activity, label: 'Editar Protocolo', action: () => { setMenuOpen(false); onEdit(protocolo); } },
            { icon: Copy,     label: 'Clonar',           action: () => { setMenuOpen(false); onClone(protocolo); } },
            { icon: Download, label: 'Exportar JSON',    action: () => { setMenuOpen(false); onExport(protocolo); } },
            { icon: Trash2,   label: 'Eliminar', danger: true, action: () => { setMenuOpen(false); onDelete(protocolo); } },
          ].filter(Boolean).map((item, i) => {
                const Icon = item.icon;
                return (
                  <button key={i} onClick={item.action} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: item.danger ? '#dc2626' : 'var(--text-primary)',
                    textAlign: 'left', transition: 'background 0.12s',
                    borderTop: item.danger ? '1px solid var(--border-color)' : 'none'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(220,38,38,0.08)' : 'var(--bg-card)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Icon size={14} style={{ color: item.danger ? '#dc2626' : 'var(--text-muted)' }} /> {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Métricas de configuración - usa conteos reales del servidor */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { icon: Activity, val: summary.numVariables, label: 'Variables',  color: '#3b82f6' },
          { icon: Shield,   val: summary.numUmbrales,  label: 'Umbrales',   color: '#f97316' },
          { icon: Zap,      val: summary.numReglas,    label: 'Reglas',     color: '#8b5cf6' },
          { icon: BarChart2,val: protocolo.tamanio_muestra || '—', label: protocolo.unidad_muestreo || 'Unidades', color: '#10b981' },
        ].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon size={12} style={{ color: m.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{m.val}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Por <strong>{protocolo.created_by || 'Sistema'}</strong> · {
            protocolo.updated_at
              ? new Date(protocolo.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'
          }
        </div>
        <button
          onClick={() => onPreview(protocolo)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8,
            background: 'rgba(21,128,61,0.1)', color: 'var(--primary)',
            border: '1px solid rgba(21,128,61,0.25)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(21,128,61,0.1)'; e.currentTarget.style.color = 'var(--primary)'; }}
        >
          <Eye size={12} /> Abrir
        </button>
      </div>
    </div>
  );
};

// ─── Vista Principal ──────────────────────────────────────────────────────────

export default function ProtocolosConfigView() {
  const { user } = useAuthContext();
  const userId = user?.id || 'admin';
  const userName = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email : 'Usuario';

  // Lotes del contexto de usuario
  let lotes = [];
  try {
    const lotsCtx = useLotsContext();
    if (lotsCtx?.lotes) lotes = lotsCtx.lotes;
  } catch (e) {
    // Si se renderiza fuera del provider
  }

  const [protocolos, setProtocolos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCultivo, setFiltroCultivo] = useState('');
  const [cultivos, setCultivos] = useState([]);

  // Combina cultivos maestros con los cultivos presentes en los lotes del usuario
  const combinedCultivos = React.useMemo(() => {
    const map = new Map();
    (cultivos || []).forEach(c => {
      if (c && c.nombre_comun) {
        map.set(c.nombre_comun.toLowerCase(), c);
      }
    });

    (lotes || []).forEach(lote => {
      const nombre = lote.cultivo || lote.cultivo_nombre;
      if (nombre && !map.has(nombre.toLowerCase())) {
        map.set(nombre.toLowerCase(), {
          id: lote.cultivo_id || `lot-crop-${nombre}`,
          nombre_comun: nombre,
          nombre_cientifico: lote.variedad ? `Variedad: ${lote.variedad}` : 'Cultivo del Lote',
          origen: 'lote'
        });
      }
    });

    return Array.from(map.values());
  }, [cultivos, lotes]);

  // UI state: 'list' | 'preview' | 'wizard'
  const [screen, setScreen] = useState('list');
  const [protocoloEditing, setProtocoloEditing] = useState(null);
  const [protocoloPreview, setProtocoloPreview] = useState(null);
  const [importando, setImportando] = useState(false);

  const cargarProtocolos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (filtroEstado) filters.estado = filtroEstado;
      if (filtroCultivo) filters.cultivo_id = filtroCultivo;
      const data = await agronomyRepository.listProtocolos(filters);
      setProtocolos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroCultivo]);

  useEffect(() => {
    cargarProtocolos();
    agronomyRepository.getCultivos()
      .then(setCultivos)
      .catch(() => {});
  }, [cargarProtocolos]);

  // Filtrado local por búsqueda de texto
  const protocolosFiltrados = protocolos.filter(p => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.objeto_evaluacion?.nombre_comun || '').toLowerCase().includes(q) ||
      (p.cultivo?.nombre_comun || '').toLowerCase().includes(q) ||
      (p.version || '').toLowerCase().includes(q)
    );
  });

  const handleClone = async (protocolo) => {
    try {
      const clon = await agronomyRepository.cloneProtocolo(protocolo.id, userId);
      setProtocoloEditing(clon);
      setScreen('wizard');
    } catch (err) {
      alert('Error al clonar el protocolo: ' + err.message);
    }
  };

  const handleDelete = async (protocolo) => {
    const nombreProtocolo = protocolo.nombre || protocolo.objeto_evaluacion?.nombre_comun || 'este protocolo';
    const confirmacion = window.confirm(`¿Estás seguro de que deseas eliminar el protocolo "${nombreProtocolo}"? Esta acción no se puede deshacer.`);
    if (!confirmacion) return;

    try {
      await agronomyRepository.deleteProtocolo(protocolo.id);
      await cargarProtocolos();
    } catch (err) {
      alert('Error al eliminar el protocolo: ' + err.message);
    }
  };

  const handlePublish = async (protocolo) => {
    try {
      // Cargar el protocolo completo para validar (la lista solo tiene resumen)
      const protocoloCompleto = await agronomyRepository.getProtocoloCompleto(protocolo.id);
      const { valido, errores } = ProtocolValidator.validate(protocoloCompleto);

      if (!valido) {
        alert(
          `❌ El protocolo no puede publicarse. Corrija los siguientes errores:\n\n` +
          errores.map(e => `• ${e}`).join('\n')
        );
        return;
      }

      await agronomyRepository.publicarProtocolo(protocolo.id, userId);
      await cargarProtocolos();
      alert('✅ Protocolo activado y publicado exitosamente.');
    } catch (err) {
      alert('Error al activar el protocolo: ' + err.message);
    }
  };

  const handleExport = (protocolo) => {
    const json = JSON.stringify(protocolo, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocolo_${protocolo.nombre || protocolo.id}_v${protocolo.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        setImportando(true);
        const json = JSON.parse(ev.target.result);
        await agronomyRepository.importProtocolo(json, userId);
        await cargarProtocolos();
        alert('✅ Protocolo importado como borrador. Revísalo antes de publicar.');
      } catch (err) {
        alert('Error al importar: ' + err.message);
      } finally {
        setImportando(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Pantalla de Vista Previa ──
  if (screen === 'preview') {
    return (
      <ProtocolPreviewView
        protocolo={protocoloPreview || protocoloEditing}
        userId={userId}
        onBack={() => { setScreen('list'); setProtocoloPreview(null); }}
        onEdit={(prot) => { setProtocoloEditing(prot); setScreen('wizard'); }}
        onClone={async (prot) => {
          try {
            const clon = await agronomyRepository.cloneProtocolo(prot.id, userId);
            setProtocoloEditing(clon);
            setScreen('wizard');
          } catch (err) { alert('Error al clonar: ' + err.message); }
        }}
        onExport={(prot) => {
          const json = JSON.stringify(prot, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = `protocolo_${prot.nombre || prot.id}.json`;
          a.click(); URL.revokeObjectURL(url);
        }}
      />
    );
  }

  // ── Pantalla del Wizard ──
  if (screen === 'wizard') {
    return (
      <ProtocolWizardForm
        protocolo={protocoloEditing}
        userId={userId}
        userName={userName}
        cultivos={combinedCultivos}
        onCancel={() => {
          // Si volvemos del wizard con un protocolo previo, ir a preview; sino a la lista
          if (protocoloEditing) {
            setProtocoloPreview(protocoloEditing);
            setScreen('preview');
          } else {
            setScreen('list');
          }
          setProtocoloEditing(null);
        }}
        onSaved={async (saved) => {
          await cargarProtocolos();
          // Redirigir a la Vista Previa del protocolo recién guardado
          setProtocoloPreview(saved);
          setProtocoloEditing(null);
          setScreen('preview');
        }}
      />
    );
  }

  // ── Estadísticas de resumen ──
  const statsTotal    = protocolos.length;
  const statsActivos  = protocolos.filter(p => p.estado === 'activo').length;
  const statsBorrador = protocolos.filter(p => p.estado === 'borrador').length;
  const statsArchivados = protocolos.filter(p => p.estado === 'archivado').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Leaf size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Configuración
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Protocolos de Evaluación
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Biblioteca de metodologías de muestreo configurables y data-driven
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Importar */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', borderRadius: 10,
            border: '1px solid var(--border-color)', background: 'var(--bg-card)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)',
            transition: 'all 0.15s'
          }}>
            <Upload size={14} />
            {importando ? 'Importando...' : 'Importar'}
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>

          {/* Nuevo protocolo */}
          <button
            onClick={() => { setProtocoloEditing(null); setScreen('wizard'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', borderRadius: 10,
              background: 'var(--primary)', color: 'white', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 16px -4px rgba(21,128,61,0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-hover, #166534)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.transform = 'none'; }}
          >
            <Plus size={15} /> Nuevo Protocolo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { val: statsTotal,     lbl: 'Total Protocolos',  icon: '📋', color: 'rgba(99,102,241,0.1)', text: '#6366f1' },
          { val: statsActivos,   lbl: 'Activos',           icon: '✅', color: 'rgba(21,128,61,0.1)',  text: '#15803d' },
          { val: statsBorrador,  lbl: 'En Borrador',       icon: '🖊️', color: 'rgba(234,179,8,0.1)',  text: '#a16207' },
          { val: statsArchivados,lbl: 'Archivados',        icon: '📁', color: 'rgba(29,78,216,0.1)',  text: '#1d4ed8' },
        ].map((k, i) => (
          <div key={i} className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.text }}>{k.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200,
          border: '1px solid var(--border-color)', borderRadius: 9, padding: '7px 12px', background: 'var(--bg-app)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cultivo, objeto..."
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', width: '100%', fontFamily: 'var(--font-sans)' }}
          />
        </div>

        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="activo">Activo</option>
          <option value="archivado">Archivado</option>
          <option value="obsoleto">Obsoleto</option>
        </select>

        <select value={filtroCultivo} onChange={e => setFiltroCultivo(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <option value="">Todos los cultivos</option>
          {combinedCultivos.map(c => <option key={c.id} value={c.id}>{c.nombre_comun}</option>)}
        </select>

        <button onClick={cargarProtocolos} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Contenido */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : protocolosFiltrados.length === 0 ? (
        <div className="glass-card" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {protocolos.length === 0 ? 'No hay protocolos configurados' : 'Sin resultados para los filtros seleccionados'}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 20px' }}>
            {protocolos.length === 0
              ? 'Crea tu primer protocolo de evaluación para comenzar a digitalizar tus metodologías de campo.'
              : 'Intenta con otros filtros o términos de búsqueda.'}
          </p>
          {protocolos.length === 0 && (
            <button
              onClick={() => { setProtocoloEditing(null); setScreen('wizard'); }}
              style={{ padding: '10px 22px', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + Crear primer protocolo
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {protocolosFiltrados.map(p => (
            <ProtocolCard
              key={p.id}
              protocolo={p}
              onEdit={(prot) => { setProtocoloEditing(prot); setScreen('wizard'); }}
              onClone={handleClone}
              onExport={handleExport}
              onPreview={(prot) => { setProtocoloPreview(prot); setScreen('preview'); }}
              onDelete={handleDelete}
              onPublish={handlePublish}
            />
          ))}
        </div>
      )}
    </div>
  );
}
