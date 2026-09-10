import React, { useState } from 'react';
import { Search, Sprout, Droplets, Package, Warehouse, Truck, MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { harvestService } from '../services/harvestService';

export function TraceabilityPanel({ loading }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // Datos demo del diseño (solo se muestran si no hay resultado y no hay loading, como placeholder visual)
  // PERO no deben confundir: si hay datos reales, se muestra trazabilidad real.
  // Si no hay búsqueda, no mostramos mock: mostramos empty.
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true); setError(null);
    try {
      const data = await harvestService.trazabilidad(code.trim());
      if (data?.error) setError(data.error);
      else setResult(data);
    } catch (err) { setError(err.message); setResult(null); }
    finally { setSearching(false); }
  };

  return (
    <div className="white-card">
      <h3 style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>Trazabilidad Rápida</h3>
      <form onSubmit={handleSearch} className="traz-search">
        <input className="traz-input" placeholder="Buscar por lote o código" value={code} onChange={e=>setCode(e.target.value)}/>
        <button className="traz-btn" type="submit" disabled={searching}>{searching? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Search size={14}/>}</button>
      </form>
      {error && <div style={{fontSize:11, color:'#dc2626', marginBottom:8}}>{error}</div>}
      {!result && !searching && !error && (
        <div style={{fontSize:11, color:'var(--text-muted)', textAlign:'center', padding:'12px 0', border:'1px dashed var(--border-color)', borderRadius:8}}>
          Ingresa un código COS-2026-000001 o PROD-2026-000001 para ver la trazabilidad completa
        </div>
      )}
      {result && (
        <div className="timeline">
          {/* Render dinámico según resultado real */}
          {result.tipo==='cosecha' && (
            <>
              <TimelineNode icon={Sprout} color="green" title="Cosecha" desc={`${result.cosecha?.cantidad_cosechada|| result.cosecha?.weight} kg · ${result.lote_agricola?.codigo_interno||''} · ${result.predio?.nombre||''}`} badge={result.cosecha?.estado}/>
              {(result.procesos||[]).map((p,i)=>(
                <TimelineNode key={i} icon={Droplets} color="amber" title={p.tipo||'Postcosecha'} desc={`${p.peso_inicial||''} kg ${p.metodo||''}`}/>
              ))}
              {(result.lotes_producto||[]).slice(0,1).map((lp,i)=>(
                <TimelineNode key={'lp'+i} icon={Package} color="violet" title="Producto Terminado" desc={`${lp.peso_actual} kg · ${lp.grado||''}`}/>
              ))}
            </>
          )}
          {result.tipo==='lote_producto' && (
            <>
              <TimelineNode icon={Sprout} color="green" title="Cosecha origen" desc={`${result.cosecha?.codigo||''} · ${result.cosecha?.cantidad_cosechada} kg`}/>
              <TimelineNode icon={Package} color="violet" title="Producto" desc={`${result.lote_producto?.peso_actual} kg · ${result.lote_producto?.grado||''} · ${result.lote_producto?.codigo}`}/>
              {result.bodega && <TimelineNode icon={Warehouse} color="blue" title="Almacenamiento" desc={`${result.bodega.nombre} · ${result.lote_producto?.peso_actual} kg`}/>}
            </>
          )}
          {/* Si no hay datos estructurados, mostrar JSON raw para debug real */}
          {(!result.tipo || (result.procesos?.length===0 && result.lotes_producto?.length===0)) && (
            <div style={{fontSize:11, color:'var(--text-muted)'}}>Trazabilidad encontrada. Sin procesos adicionales registrados.</div>
          )}
        </div>
      )}
      {/* Placeholder visual solo si no hay datos reales y es primera carga - opcional, comentado para zero-mock estricto
      {!result && !searching && (
        <div className="timeline" style={{opacity:0.6}}>
          <div style={{fontSize:10, color:'var(--text-muted)', marginBottom:4}}>Ejemplo (datos demo ocultan cuando hay datos reales)</div>
        </div>
      )} */}
      {result && (
        <button style={{marginTop:12, width:'100%', padding:'8px', borderRadius:8, border:'1px solid var(--border-color)', background:'white', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>Ver trazabilidad completa <ExternalLink size={12}/></button>
      )}
    </div>
  );
}

function TimelineNode({ icon:Icon, color, title, desc, badge }) {
  return (
    <div className="tl-node">
      <div className={`tl-dot ${color}`}><Icon size={10}/></div>
      <div className="tl-content">
        <div className="tl-title">{title} {badge && <span className={`tl-badge badge-${color}`}>{badge}</span>}</div>
        <div className="tl-desc">{desc}</div>
      </div>
    </div>
  );
}
export default TraceabilityPanel;
