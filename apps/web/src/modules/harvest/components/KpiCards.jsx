import React from 'react';
import { Sprout, MapPin, TrendingUp, Warehouse } from 'lucide-react';

export function KpiCards({ dashboard, loading }) {
  if (loading) {
    return (
      <div className="kpi-grid">
        {[1,2,3,4].map(i=>(
          <div key={i} className="kpi-card" style={{height:110}}>
            <div className="skeleton" style={{height:14, width:'50%', marginBottom:12}}/>
            <div className="skeleton" style={{height:24, width:'40%', marginBottom:8}}/>
            <div className="skeleton" style={{height:10, width:'70%'}}/>
          </div>
        ))}
      </div>
    );
  }
  const d = dashboard?.dashboard || dashboard || {};
  const acumKg = d.cosecha_acumulada_kg || 0;
  const acumT = (acumKg/1000).toFixed(2);
  const area = d.area_cosechada_ha || 0;
  const rend = d.rendimiento_kg_ha || 0;
  const almacenado = d.producto_almacenado_kg || 0;
  const bodegas = d.bodegas_con_stock ?? 0;
  const cosechas = d.cosechas_registradas ?? 0;

  const hasData = acumKg>0 || area>0;
  return (
    <div className="kpi-grid">
      <div className="kpi-card green">
        <div className="kpi-label"><span>COSECHA ACUMULADA</span><span style={{color:'#15803d'}}><Sprout size={14}/></span></div>
        <div className="kpi-value">{acumT} T</div>
        <div className="kpi-sub" style={{color: hasData?'#16a34a':'var(--text-muted)'}}>{hasData ? 'Datos reales del periodo seleccionado' : 'Sin datos en el periodo'}</div>
        <div className="kpi-foot">{cosechas} cosechas registradas</div>
      </div>
      <div className="kpi-card blue">
        <div className="kpi-label"><span>ÁREA COSECHADA</span><span style={{color:'#2563eb'}}><MapPin size={14}/></span></div>
        <div className="kpi-value">{area.toFixed(2)} ha</div>
        <div className="kpi-sub" style={{color: hasData?'#16a34a':'var(--text-muted)'}}>{hasData ? 'Calculado desde lotes registrados' : 'Sin área registrada'}</div>
        <div className="kpi-foot">Área total cosechada</div>
      </div>
      <div className="kpi-card violet">
        <div className="kpi-label"><span>RENDIMIENTO PROMEDIO</span><TrendingUp size={14}/></div>
        <div className="kpi-value">{rend.toLocaleString('es-CO', {maximumFractionDigits:0})} kg/ha</div>
        <div className="kpi-sub" style={{color: hasData?'#16a34a':'var(--text-muted)'}}>{hasData ? 'Rendimiento = cantidad / área' : 'Sin cálculo disponible'}</div>
        <div className="kpi-foot">Rendimiento calculado</div>
      </div>
      <div className="kpi-card amber">
        <div className="kpi-label"><span>PRODUCTO ALMACENADO</span><Warehouse size={14}/></div>
        <div className="kpi-value">{almacenado.toLocaleString('es-CO')} kg</div>
        <div className="kpi-sub muted">En {bodegas} bodegas</div>
        <div className="kpi-foot">Stock disponible</div>
      </div>
    </div>
  );
}
export default KpiCards;
