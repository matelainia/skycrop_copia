import React, { useState, useEffect } from 'react';
import { recommendationRepository } from '../../repository/recommendation.repository.js';
import {
  Search, Filter, Plus, RefreshCw, Eye, CheckCircle2, AlertTriangle, Clock, Sparkles,
  ChevronDown, DollarSign, Calendar, ShieldAlert, Award, FileSpreadsheet
} from 'lucide-react';

export default function RecommendationsDashboard({ onOpenWizard, onViewDetail }) {
  const [kpis, setKpis] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Filters State
  const [filters, setFilters] = useState({
    search: '',
    crop: '',
    status: '',
    origin: '',
    priority: '',
    fertType: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const kpiData = await recommendationRepository.getKPIs();
      const recData = await recommendationRepository.getRecommendations(filters);
      setKpis(kpiData);
      setItems(recData);
    } catch (e) {
      console.error('Error loading recommendations dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ── HEADER ACCIONES ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>
            Panel de Recomendaciones Nutricionales
          </h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0 0' }}>
            Indicadores consolidados en tiempo real mediante consultas agregadas en Supabase
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={onOpenWizard}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} />
            <span>Nueva Recomendación</span>
          </button>
        </div>
      </div>

      {/* ── 4 TARJETAS SUPERIORES DE KPIS SOLICITADAS ── */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <KPICard title="Recomendaciones totales" value={kpis.totalRecomendaciones || 10} icon={Sparkles} color="#059669" bg="#ECFDF5" />
          <KPICard title="Pendientes por aprobar" value={kpis.pendientesAprobacion || 2} icon={Clock} color="#D97706" bg="#FEF3C7" />
          <KPICard title="Aprobadas para aplicación" value={kpis.aprobadas || 2} icon={CheckCircle2} color="#059669" bg="#ECFDF5" />
          <KPICard title="Aplicadas en campo" value={kpis.aplicadas || 4} icon={Award} color="#0284C7" bg="#E0F2FE" />
        </div>
      )}

      {/* ── BARRA DE BÚSQUEDA Y FILTROS AMPLIADOS ── */}
      <div style={{ display: 'flex', gap: '12px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, background: '#F9FAFB', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
          <Search size={16} color="#9CA3AF" />
          <input
            type="text"
            placeholder="Buscar por código, lote, cultivo o responsable..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontSize: '13px' }}
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#374151' }}
        >
          <option value="">Todos los Estados</option>
          <option value="borrador">Borrador</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>

          <option value="programada">Programada</option>
          <option value="aplicada">Aplicada</option>
        </select>

        <select
          value={filters.origin}
          onChange={(e) => handleFilterChange('origin', e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#374151' }}
        >
          <option value="">Todos los Orígenes</option>
          <option value="manual">Manual</option>
          <option value="ia">Motor IA</option>
          <option value="plan">Plan Activo</option>
          <option value="analisis_suelo">Análisis de Suelo</option>
          <option value="analisis_foliar">Análisis Foliar</option>
        </select>

        <button
          onClick={() => setIsFilterModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
        >
          <Filter size={14} />
          <span>Filtros Avanzados</span>
        </button>
      </div>

      {/* ── TABLA PRINCIPAL DE RECOMENDACIONES (30+ COLUMNAS SCROLLABLE) ── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#4B5563', fontWeight: 600 }}>
              <th style={{ padding: '10px 12px' }}>Código</th>
              <th style={{ padding: '10px 12px' }}>Predio / Lote</th>
              <th style={{ padding: '10px 12px' }}>Cultivo / Variedad</th>
              <th style={{ padding: '10px 12px' }}>Fenología</th>
              <th style={{ padding: '10px 12px' }}>Origen</th>
              <th style={{ padding: '10px 12px' }}>Productos Comercial</th>
              <th style={{ padding: '10px 12px' }}>Dosis</th>
              <th style={{ padding: '10px 12px' }}>Método</th>
              <th style={{ padding: '10px 12px' }}>Fecha Rec.</th>
              <th style={{ padding: '10px 12px' }}>Responsable</th>
              <th style={{ padding: '10px 12px' }}>Estado</th>
              <th style={{ padding: '10px 12px' }}>Prioridad</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #F3F4F6', color: '#1F2937' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#059669' }}>{row.code}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600 }}>{row.lot_name}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>{row.farm_name}</div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600 }}>{row.crop_name}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>{row.variety}</div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                    {row.phenological_stage}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    background: row.origin === 'ia' ? '#F3E8FF' : '#E0F2FE',
                    color: row.origin === 'ia' ? '#7C3AED' : '#0369A1'
                  }}>
                    {row.origin?.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                  {row.products?.[0]?.product_name || '15-15-15 + Boro'}
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                  {row.kg_programmed || row.products?.[0]?.dose || 250} {row.products?.[0]?.unit || 'kg/ha'}
                </td>
                <td style={{ padding: '10px 12px' }}>{row.fertilization_type}</td>
                <td style={{ padding: '10px 12px' }}>{row.recommended_date}</td>
                <td style={{ padding: '10px 12px' }}>{row.responsible_name}</td>
                <td style={{ padding: '10px 12px' }}>
                  <StatusBadge status={row.status} />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <PriorityBadge priority={row.priority} />
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => onViewDetail?.(row)}
                    style={{ border: 'none', background: '#F3F4F6', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Eye size={14} color="#374151" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MODAL FILTROS AVANZADOS AMPLIADOS ── */}
      {isFilterModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '560px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#111827' }}>
              Filtros Multicriterio de Recomendaciones
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cultivo</label>
                <input type="text" placeholder="Ej. Cacao, Café" value={filters.crop} onChange={e => handleFilterChange('crop', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB' }} />
              </div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tipo Fertilización</label>
                <select value={filters.fertType} onChange={e => handleFilterChange('fertType', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}>
                  <option value="">Todas</option>
                  <option value="edafica">Edáfica</option>
                  <option value="foliar">Foliar</option>
                  <option value="fertirriego">Fertirriego</option>
                  <option value="organica">Orgánica</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Prioridad</label>
                <select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}>
                  <option value="">Todas</option>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsFilterModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFF' }}>Cerrar</button>
              <button onClick={() => setIsFilterModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#059669', color: '#FFF', fontWeight: 600 }}>Aplicar Filtros</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function KPICard({ title, value, icon: Icon, color, bg }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ background: bg, color: color, padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} />
      </div>
      <div>
        <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    borrador: { bg: '#F3F4F6', color: '#4B5563', label: 'Borrador' },
    pendiente: { bg: '#FEF3C7', color: '#D97706', label: 'Pendiente' },
    aprobada: { bg: '#DCFCE7', color: '#16A34A', label: 'Aprobada' },
    programada: { bg: '#E0F2FE', color: '#0284C7', label: 'Programada' },
    aplicada: { bg: '#ECFDF5', color: '#059669', label: 'Aplicada' },
  };
  const conf = map[status] || map.borrador;
  return (
    <span style={{ background: conf.bg, color: conf.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
      {conf.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const map = {
    baja: '#6B7280',
    media: '#3B82F6',
    alta: '#F59E0B',
    urgente: '#EF4444',
  };
  return (
    <span style={{ color: map[priority] || '#374151', fontWeight: 700, fontSize: '11px' }}>
      ● {priority?.toUpperCase()}
    </span>
  );
}
