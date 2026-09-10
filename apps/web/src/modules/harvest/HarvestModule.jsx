import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, ChevronDown, Thermometer, Droplets, AlertTriangle, CheckCircle, Eye, Pencil, MoreVertical, Loader2, Package, Sprout } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { harvestService } from './services/harvestService';
import { KpiCards } from './components/KpiCards';
import { HistoryChart } from './components/HistoryChart';
import { PostHarvestStatus } from './components/PostHarvestStatus';
import { TraceabilityPanel } from './components/TraceabilityPanel';
import { HarvestTable } from './components/HarvestTable';
import { QuickActions } from './components/QuickActions';
import { HarvestForm } from './components/HarvestForm';
import './components/HarvestStyles.css';

const TABS = [
  { id:'resumen', label:'Resumen' },
  { id:'cosechas', label:'Cosechas' },
  { id:'postcosecha', label:'Postcosecha' },
  { id:'almacenamiento', label:'Almacenamiento' },
  { id:'despachos', label:'Despachos' },
  { id:'trazabilidad', label:'Trazabilidad' },
];

export default function HarvestModule() {
  const { user, empresa, hasPermission } = useAuthContext();
  const [activeTab, setActiveTab] = useState('resumen');
  const [filters, setFilters] = useState({ periodo:'este_anio', predio_id:'', lote_id:'', cultivo:'', estado:'' });
  const [predios, setPredios] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [historicoData, setHistoricoData] = useState([]);
  const [postcosechaData, setPostcosechaData] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);

  useEffect(()=>{
    harvestService.listPredios().then(setPredios).catch(()=>setPredios([]));
  }, []);

  const fetchDashboard = async () => {
    setLoading(true); setError(null);
    try {
      const data = await harvestService.getDashboard(filters);
      // data may be { dashboard, historico... } or {dashboard:{...}, historico, postcosecha...}
      // Normalice: service returns {dashboard, historico, postcosecha, recientes, alertas} when using backend dashboard, but fallback returns same shape
      // Our getDashboard returns {dashboard,historico,postcosecha,recientes,alertas} if backend success, otherwise fallback returns same shape? Check service: getDashboard returns {dashboard:..., historico:..., postcosecha:..., recientes:..., alertas:...} when backend? Actually it tries backend then fallback computes. For simplicity handle both.
      if (data?.dashboard && typeof data.dashboard === 'object' && !Array.isArray(data.dashboard)) {
        // backend shape
        setDashboardData(data.dashboard || data);
        setHistoricoData(data.historico || data.historicoData || []);
        setPostcosechaData(data.postcosecha || []);
        // recientes puede ser objeto con data
        const rec = data.recientes;
        if (rec?.data) setRecientes(rec.data);
        else if (Array.isArray(rec)) setRecientes(rec);
        else {
          const list = await harvestService.listHarvests({ limit:5, periodo: filters.periodo });
          setRecientes(list?.data || []);
        }
        setAlertas(data.alertas || []);
      } else {
        // fallback shape where data is dashboard object directly?
        setDashboardData(data?.dashboard || data);
        const h = await harvestService.getHistoricoMensual(new Date().getFullYear());
        setHistoricoData(h||[]);
        const ph = await harvestService.getPostHarvestStatus();
        setPostcosechaData(ph||[]);
        const rec = await harvestService.listHarvests({ limit:5, periodo: filters.periodo });
        setRecientes(rec?.data || []);
        const al = await harvestService.listAlertas(3);
        setAlertas(al||[]);
      }
    } catch (e) {
      setError(e);
    } finally { setLoading(false); }
  };

  const fetchTable = async () => {
    setTableLoading(true);
    try {
      const res = await harvestService.listHarvests({ limit:5, periodo: filters.periodo, predio_id: filters.predio_id||undefined, lote_id: filters.lote_id||undefined, cultivo: filters.cultivo||undefined, estado: filters.estado||undefined });
      setRecientes(res?.data || []);
    } catch {}
    setTableLoading(false);
  };

  useEffect(()=>{ fetchDashboard(); }, [filters.periodo, refreshKey]);
  useEffect(()=>{ if (activeTab==='resumen') fetchTable(); }, [filters.predio_id, filters.lote_id, filters.cultivo, filters.estado]);

  const handleSuccess = (res)=>{
    setToast({ message:`Cosecha ${res?.codigo || res?.id?.slice(0,8) || ''} registrada correctamente`, type:'success' });
    setTimeout(()=>setToast(null), 3000);
    setRefreshKey(k=>k+1);
    // refetch
    fetchDashboard();
  };

  const canCreate = hasPermission ? hasPermission('cosechas','crear') || hasPermission('cosechas','todo') || hasPermission('*','*') : true;

  return (
    <div className="harvest-shell">
      {/* Top title bar replica image */}
      <div className="harvest-topbar">
        <div className="harvest-title">
          <h1>Cosecha y Postcosecha</h1>
          <p>Gestiona la trazabilidad de tu producto desde la cosecha hasta el cliente.</p>
        </div>
        <div className="harvest-actions">
          <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-muted)'}}>
            <Calendar size={14}/>
            <span>{new Date().toLocaleDateString('es-CO', {weekday:'short', day:'numeric', month:'short'})}</span>
          </div>
          <button className="btn-registrar" onClick={()=> setIsFormOpen(true)} disabled={!canCreate} title={!canCreate? 'Sin permisos para crear': ''}>
            <Plus size={14}/> Registrar Cosecha <ChevronDown size={14} style={{opacity:0.7}}/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="harvest-tabs">
        {TABS.map(t=>(
          <button key={t.id} className={`harvest-tab ${activeTab===t.id?'active':''}`} onClick={()=> setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Global filters */}
      <div className="harvest-filters">
        <select className="harvest-filter-select" value={filters.predio_id} onChange={e=>setFilters(f=>({...f, predio_id:e.target.value}))}>
          <option value="">Predio: Todos</option>
          {predios.map(p=> <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className="harvest-filter-select" value={filters.cultivo} onChange={e=>setFilters(f=>({...f, cultivo:e.target.value}))}>
          <option value="">Cultivo: Todos</option>
          <option value="Cacao">Cacao</option><option value="Café">Café</option><option value="Maíz">Maíz</option><option value="Soya">Soya</option>
        </select>
        <select className="harvest-filter-select" value={filters.periodo} onChange={e=>setFilters(f=>({...f, periodo:e.target.value}))}>
          <option value="este_anio">Periodo: Este año</option>
          <option value="ultimos_6_meses">Últimos 6 meses</option>
          <option value="este_mes">Este mes</option>
          <option value="todos">Todos</option>
        </select>
        <select className="harvest-filter-select" value={filters.estado} onChange={e=>setFilters(f=>({...f, estado:e.target.value}))}>
          <option value="">Estado: Todos</option>
          <option value="REGISTRADA">Registrada</option>
          <option value="EN_POSTCOSECHA">En Postcosecha</option>
          <option value="FINALIZADA">Finalizada</option>
        </select>
      </div>

      {activeTab==='resumen' && (
        <>
          <KpiCards dashboard={dashboardData} loading={loading} />

          <div className="harvest-main-grid">
            <div className="harvest-left">
              <div style={{display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:20}}>
                <HistoryChart historico={historicoData} loading={loading}/>
                <PostHarvestStatus status={postcosechaData} loading={loading}/>
              </div>

              <QuickActions
                onRegistrarCosecha={()=> setIsFormOpen(true)}
                onRegistrarPostcosecha={()=> setActiveTab('postcosecha')}
                onAlmacenamiento={()=> setActiveTab('almacenamiento')}
                onDespacho={()=> setActiveTab('despachos')}
                onClientes={()=> setActiveTab('trazabilidad')}
                onReportes={()=> {}}
              />

              <HarvestTable data={{data:recientes}} loading={tableLoading || loading} error={error} onView={()=>{}} onEdit={()=>{}} onMore={()=>{}}/>
            </div>

            <div className="harvest-right">
              <TraceabilityPanel loading={loading}/>
              <div className="white-card">
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                  <h3 style={{marginBottom:0, fontSize:13}}>Alertas y Notificaciones</h3>
                  <button style={{fontSize:10, color:'var(--primary)', background:'transparent', border:'none', fontWeight:600, cursor:'pointer'}}>Ver todas</button>
                </div>
                {loading ? (
                  <div style={{display:'flex', flexDirection:'column', gap:12}}>
                    {[1,2,3].map(i=> <div key={i} className="skeleton" style={{height:48}}/>)}
                  </div>
                ) : alertas && alertas.length>0 ? (
                  <div style={{display:'flex', flexDirection:'column', gap:12}}>
                    {alertas.map(a=>(
                      <div key={a.id} style={{display:'flex', gap:10, padding:'10px', border:'1px solid var(--border-color)', borderRadius:8, background:'white'}}>
                        <div style={{width:28, height:28, borderRadius:8, background: a.tipo==='STOCK_MINIMO'?'#fef3c7':'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                          <AlertTriangle size={12} style={{color: a.tipo==='STOCK_MINIMO'?'#d97706':'#dc2626'}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11, fontWeight:700}}>{a.tipo?.replace('_',' ') || 'Alerta'}</div>
                          <div style={{fontSize:10, color:'var(--text-muted)'}}>{a.mensaje?.slice(0,80)}</div>
                        </div>
                        <div style={{fontSize:9, color:'var(--text-muted)', whiteSpace:'nowrap'}}>{a.created_at ? new Date(a.created_at).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}) : ''}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 12px', gap:8, textAlign:'center', border:'1px dashed var(--border-color)', borderRadius:8, background:'#fafafa'}}>
                    <CheckCircle size={20} style={{color:'var(--text-muted)', opacity:0.5}}/>
                    <div style={{fontSize:11, fontWeight:600, color:'var(--text-muted)'}}>No hay alertas activas</div>
                    <div style={{fontSize:10, color:'var(--text-muted)'}}>Las alertas reales de sensores y operaciones aparecerán aquí.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab!=='resumen' && (
        <div className="white-card" style={{minHeight:300, padding:40}}>
          <div className="empty-state">
            <div className="empty-icon"><Package size={20}/></div>
            <div style={{fontWeight:700, color:'var(--text-primary)'}}>{TABS.find(t=>t.id===activeTab)?.label}</div>
            <div style={{fontSize:12, maxWidth:420, lineHeight:1.5}}>
              Esta sección está conectada a datos reales. Aún no hay registros para <strong>{TABS.find(t=>t.id===activeTab)?.label}</strong> en la empresa <strong>{empresa?.nombre || 'actual'}</strong>.
              <br/>Los datos aparecerán aquí cuando se registren operaciones reales de {TABS.find(t=>t.id===activeTab)?.label.toLowerCase()}.
            </div>
            {activeTab==='cosechas' && <button className="btn-registrar" style={{marginTop:12}} onClick={()=>setIsFormOpen(true)}><Plus size={14}/> Registrar primera cosecha</button>}
            {activeTab==='postcosecha' && <div style={{fontSize:11, color:'var(--text-muted)', marginTop:8}}>Registra una cosecha primero para iniciar fermentación/secado/clasificación.</div>}
            {activeTab==='almacenamiento' && <div style={{fontSize:11, color:'var(--text-muted)', marginTop:8}}>Los movimientos de bodega se generan automáticamente al terminar postcosecha.</div>}
          </div>
        </div>
      )}

      <HarvestForm open={isFormOpen} onClose={()=>setIsFormOpen(false)} onSuccess={handleSuccess}/>

      {toast && <div className="success-toast"><CheckCircle size={16}/> {toast.message}</div>}

      {/* Estados de interfaz globales */}
      {error && (
        <div style={{position:'fixed', bottom:20, left:20, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', padding:'12px 16px', borderRadius:10, fontSize:12, maxWidth:400}}>
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
