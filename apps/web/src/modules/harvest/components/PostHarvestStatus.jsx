import React from 'react';
import { Sprout, Droplets, PackageCheck, Warehouse, ShoppingCart, Loader2 } from 'lucide-react';

const iconMap = {
  'Cosechado': { Icon: Sprout, cls:'green' },
  'En Beneficio': { Icon: Droplets, cls:'amber' },
  'En Secado': { Icon: PackageCheck, cls:'violet' },
  'Almacenado': { Icon: Warehouse, cls:'blue' },
  'Vendido': { Icon: ShoppingCart, cls:'teal' },
};

export function PostHarvestStatus({ status, loading }) {
  if (loading) {
    return (
      <div className="white-card" style={{minHeight:200}}>
        <h3>Estado de Postcosecha</h3>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', padding:40, gap:10, color:'var(--text-muted)'}}>
          <Loader2 size={24} style={{animation:'spin 1s linear infinite', color:'var(--primary)'}}/>
          <span style={{fontSize:12}}>Cargando estado...</span>
        </div>
      </div>
    );
  }
  const rows = status || [];
  return (
    <div className="white-card">
      <h3>Estado de Postcosecha</h3>
      <div className="status-list">
        {rows.map((r,i)=>{
          const cfg = iconMap[r.estado] || { Icon: Sprout, cls:'green' };
          const pct = r.pct ?? 0;
          return (
            <div key={i} className="status-row">
              <div className={`status-icon ${cfg.cls}`}><cfg.Icon size={14}/></div>
              <div className="status-meta">
                <span className="status-name">{r.estado}</span>
                <span className="status-kg">{(r.kg??0).toLocaleString('es-CO')} kg</span>
                <span className="status-pct">{pct}%</span>
              </div>
            </div>
          );
        })}
        {rows.length===0 && <div style={{fontSize:12, color:'var(--text-muted)', padding:20, textAlign:'center'}}>Sin datos de postcosecha</div>}
      </div>
    </div>
  );
}
export default PostHarvestStatus;
