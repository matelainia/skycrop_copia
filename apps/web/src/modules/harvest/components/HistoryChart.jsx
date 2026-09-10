import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

export function HistoryChart({ historico, loading }) {
  const [year] = useState(new Date().getFullYear());
  if (loading) {
    return (
      <div className="white-card">
        <div className="chart-header"><div className="skeleton" style={{height:16, width:140}}/><div className="skeleton" style={{height:24, width:80}}/></div>
        <div className="skeleton" style={{height:170, width:'100%'}}/>
      </div>
    );
  }
  const data = historico || [];
  // historico shape from RPC: [{mes, mes_nombre, total_kg},...] or fallback
  const isEmpty = !data || data.length===0 || data.every(d=> (d.total_kg||0)===0);
  const max = Math.max(1, ...data.map(d=> d.total_kg || d.total || 0));
  return (
    <div className="white-card">
      <div className="chart-header">
        <h3 style={{display:'flex', alignItems:'center', gap:6}}>Cosecha Histórica (kg) <BarChart3 size={14} style={{color:'var(--primary)'}}/></h3>
        <select className="chart-period" value={year} disabled>
          <option>Este año</option>
        </select>
      </div>
      {isEmpty ? (
        <div className="chart-empty">
          <BarChart3 size={28} style={{opacity:0.3}}/>
          <span>No hay cosechas registradas este año</span>
          <span style={{fontSize:11}}>Registra tu primera cosecha para ver el histórico</span>
        </div>
      ) : (
        <div className="chart-area">
          <svg className="chart-svg" viewBox="0 0 360 170" preserveAspectRatio="none">
            {/* grid lines */}
            {[0,1,2,3].map(i=>(
              <g key={i}>
                <line x1={40} x2={350} y1={20 + i*40} y2={20 + i*40} stroke="#f3f4f6" strokeWidth={1}/>
                <text x={0} y={24 + i*40} fontSize={9} fill="#9ca3af">{(max - (max/3)*i).toFixed(0)}</text>
              </g>
            ))}
            {/* area + line */}
            {(()=>{
              const pts = data.map((d,idx)=>{
                const x = 40 + (idx*(310/(data.length-1||1)));
                const y = 140 - ((d.total_kg||0)/max)*120;
                return `${x},${y}`;
              }).join(' ');
              const areaPts = `40,140 ${pts} ${40 + ((data.length-1)*(310/(data.length-1||1)))},140`;
              return (
                <>
                  <polygon points={areaPts} fill="rgba(21,128,61,0.08)" stroke="none"/>
                  <polyline points={pts} fill="none" stroke="#16a34a" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
                  {data.map((d,idx)=>{
                    const x = 40 + (idx*(310/(data.length-1||1)));
                    const y = 140 - ((d.total_kg||0)/max)*120;
                    return <g key={idx}>
                      <circle cx={x} cy={y} r={4} fill="#16a34a" stroke="white" strokeWidth={2}/>
                      <text x={x} y={158} fontSize={8} fill="#6b7280" textAnchor="middle">{d.mes_nombre || d.month || idx+1}</text>
                    </g>;
                  })}
                </>
              );
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}
export default HistoryChart;
