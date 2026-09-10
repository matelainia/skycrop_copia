import React from 'react';
import { Eye, Pencil, MoreVertical, Loader2, Sprout } from 'lucide-react';

function Badge({ estado }) {
  const map = {
    'REGISTRADA': 'badge-green', 'EN_POSTCOSECHA':'badge-amber', 'FINALIZADA':'badge-blue',
    'BORRADOR':'badge-violet', 'ANULADA':'badge-red',
    'En Almacenamiento':'badge-blue', 'En Secado':'badge-violet', 'En Beneficio':'badge-amber', 'Cosechado':'badge-green',
  };
  const cls = map[estado] || 'badge-green';
  // Normalizar estado visible
  const label = estado==='REGISTRADA'? 'En Almacenamiento' : estado;
  return <span className={`badge ${cls}`} style={{fontSize:10, padding:'2px 8px'}}>{label}</span>;
}

export function HarvestTable({ data, loading, error, onView, onEdit, onMore }) {
  if (loading) {
    return (
      <div className="white-card">
        <h3>Cosechas Recientes</h3>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', padding:40, gap:10, color:'var(--text-muted)'}}>
          <Loader2 size={24} style={{animation:'spin 1s linear infinite', color:'var(--primary)'}}/>
          <span style={{fontSize:12}}>Cargando cosechas...</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="white-card">
        <h3>Cosechas Recientes</h3>
        <div style={{padding:20, textAlign:'center', color:'#dc2626', fontSize:12}}>{error.message || 'Error cargando cosechas'}</div>
      </div>
    );
  }
  const rows = data?.data || data || [];
  const isEmpty = !rows || rows.length===0;
  return (
    <div className="white-card" style={{paddingBottom:8}}>
      <h3>Cosechas Recientes</h3>
      <div style={{overflowX:'auto'}}>
        <table className="harvest-table">
          <thead>
            <tr>
              <th>LOTE DE COSECHA</th>
              <th>CULTIVO</th>
              <th>LOTE AGRÍCOLA</th>
              <th>ÁREA (ha)</th>
              <th>CANTIDAD (kg)</th>
              <th>RENDIMIENTO (kg/ha)</th>
              <th>RESPONSABLE</th>
              <th>FECHA</th>
              <th>ESTADO</th>
              <th style={{textAlign:'right'}}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr><td colSpan={10}><div className="empty-state">
                <div className="empty-icon"><Sprout size={20}/></div>
                <div style={{fontWeight:700, color:'var(--text-primary)', fontSize:13}}>No hay cosechas registradas</div>
                <div style={{fontSize:11, maxWidth:320}}>Aún no se han registrado cosechas para este predio. Registra la primera cosecha para comenzar la trazabilidad.</div>
              </div></td></tr>
            ) : rows.map(r=>(
              <tr key={r.id}>
                <td style={{fontWeight:700, color:'var(--primary)', display:'flex', alignItems:'center', gap:6}}><Sprout size={12} style={{color:'#16a34a'}}/>{r.codigo}</td>
                <td style={{fontWeight:600}}>{r.cultivo}</td>
                <td>{r.lote_agricola}</td>
                <td>{r.area != null ? Number(r.area).toFixed(2) : '—'}</td>
                <td style={{fontWeight:700}}>{Number(r.cantidad).toLocaleString('es-CO')}</td>
                <td>{r.rendimiento ? Math.round(r.rendimiento).toLocaleString('es-CO') : '—'}</td>
                <td>{r.responsable}</td>
                <td>{r.fecha ? new Date(r.fecha).toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric'}) : '—'}</td>
                <td><Badge estado={r.estado}/></td>
                <td style={{textAlign:'right'}}><div className="actions-cell">
                  <button className="icon-btn" onClick={()=>onView?.(r)} title="Ver"><Eye size={12}/></button>
                  <button className="icon-btn" onClick={()=>onEdit?.(r)} title="Editar"><Pencil size={12}/></button>
                  <button className="icon-btn" onClick={()=>onMore?.(r)} title="Más"><MoreVertical size={12}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isEmpty && (
        <div style={{display:'flex', justifyContent:'center', padding:'12px 0 8px', borderTop:'1px solid var(--border-color)', marginTop:12}}>
          <button style={{background:'transparent', border:'none', fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>Ver todas las cosechas →</button>
        </div>
      )}
    </div>
  );
}
export default HarvestTable;
