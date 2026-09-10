import React, { useEffect, useState } from 'react';
import { X, MapPin, Leaf, Users, Crosshair, Loader2 } from 'lucide-react';
import { harvestService } from '../services/harvestService';
import { calcularRendimiento } from '../utils/harvestCalculations';

export function HarvestForm({ open, onClose, onSuccess }) {
  const [predios, setPredios] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [form, setForm] = useState({
    predio_id: '',
    lote_agricola_id: '',
    cultivo: 'Cacao',
    variedad: '',
    fecha: new Date().toISOString().slice(0,10),
    hora: new Date().toTimeString().slice(0,5),
    area_cosechada: '',
    cantidad: '',
    unidad: 'kg',
    numero_plantas: '',
    observaciones: '',
    responsable: '',
    cuadrilla: '',
    latitud: '',
    longitud: '',
    precision_gps: '',
  });

  useEffect(()=>{
    if (!open) return;
    setLoadingMeta(true);
    Promise.all([harvestService.listPredios().catch(()=>[]), harvestService.listTrabajadores().catch(()=>[])])
      .then(([p,t])=>{
        setPredios(p||[]);
        setTrabajadores(t||[]);
        if (p && p.length===1) setForm(f=>({...f, predio_id: p[0].id}));
      }).finally(()=>setLoadingMeta(false));
  }, [open]);

  useEffect(()=>{
    if (!form.predio_id) { setLotes([]); return; }
    harvestService.listLotes(form.predio_id).then(setLotes).catch(()=>setLotes([]));
  }, [form.predio_id]);

  const handleChange = (k,v)=> setForm(f=>({...f, [k]:v}));
  const rendimiento = form.area_cosechada && form.cantidad ? calcularRendimiento(parseFloat(form.cantidad)||0, parseFloat(form.area_cosechada)||0) : 0;

  const handleGps = ()=>{
    if (!navigator.geolocation) { setError('Geolocalización no soportada'); return; }
    setGpsLoading(true); setError(null);
    navigator.geolocation.getCurrentPosition(pos=>{
      handleChange('latitud', pos.coords.latitude.toFixed(6));
      handleChange('longitud', pos.coords.longitude.toFixed(6));
      handleChange('precision_gps', pos.coords.accuracy.toFixed(1));
      setGpsLoading(false);
    }, err=>{
      setError('No se pudo obtener GPS: ' + err.message);
      setGpsLoading(false);
    }, { enableHighAccuracy:true, timeout:10000 });
  };

  const handleSubmit = async (e)=>{
    e.preventDefault();
    setError(null);
    if (!form.cultivo || !form.cantidad || parseFloat(form.cantidad)<=0) { setError('Cultivo y cantidad son obligatorios'); return; }
    if (form.area_cosechada && parseFloat(form.area_cosechada)<=0) { setError('Área debe ser >0'); return; }
    setSaving(true);
    try {
      const payload = {
        predio_id: form.predio_id || null,
        lote_agricola_id: form.lote_agricola_id || null,
        cultivo: form.cultivo,
        variedad: form.variedad || null,
        area_cosechada: form.area_cosechada ? parseFloat(form.area_cosechada) : null,
        cantidad: parseFloat(form.cantidad),
        unidad: form.unidad || 'kg',
        numero_plantas: form.numero_plantas ? parseInt(form.numero_plantas) : null,
        responsable: form.responsable || null,
        observaciones: form.observaciones || null,
        latitud: form.latitud ? parseFloat(form.latitud) : null,
        longitud: form.longitud ? parseFloat(form.longitud) : null,
        precision_gps: form.precision_gps ? parseFloat(form.precision_gps) : null,
      };
      const res = await harvestService.createHarvest(payload);
      onSuccess?.(res);
      // reset
      setForm({
        predio_id: predios[0]?.id || '',
        lote_agricola_id: '',
        cultivo: 'Cacao',
        variedad: '',
        fecha: new Date().toISOString().slice(0,10),
        hora: new Date().toTimeString().slice(0,5),
        area_cosechada: '',
        cantidad: '',
        unidad: 'kg',
        numero_plantas: '',
        observaciones: '',
        responsable: '',
        cuadrilla: '',
        latitud: '',
        longitud: '',
        precision_gps: '',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error registrando cosecha');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e=>e.stopPropagation()} style={{width:620}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-color)', paddingBottom:12}}>
          <h2 style={{fontSize:16, fontWeight:800}}>+ Registrar Cosecha</h2>
          <button onClick={onClose} style={{width:32, height:32, borderRadius:8, border:'1px solid var(--border-color)', background:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'}}><X size={14}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:14}}>
          {/* Origen */}
          <div className="form-section">
            <h4><MapPin size={14}/> Información de origen</h4>
            <div className="form-grid">
              <div className="form-field">
                <label>Predio *</label>
                <select value={form.predio_id} onChange={e=>handleChange('predio_id', e.target.value)} required disabled={loadingMeta}>
                  <option value="">{loadingMeta? 'Cargando...' : 'Seleccionar predio'}</option>
                  {predios.map(p=> <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                {predios.length===0 && !loadingMeta && <div style={{fontSize:10, color:'var(--text-muted)', marginTop:4}}>No hay predios registrados. Cree uno primero.</div>}
              </div>
              <div className="form-field">
                <label>Lote agrícola *</label>
                <select value={form.lote_agricola_id} onChange={e=>handleChange('lote_agricola_id', e.target.value)}>
                  <option value="">Seleccionar lote</option>
                  {lotes.map(l=> <option key={l.id} value={l.id}>{l.codigo_interno} - {l.nombre} ({l.cultivo})</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Cultivo *</label>
                <select value={form.cultivo} onChange={e=>handleChange('cultivo', e.target.value)} required>
                  <option value="Cacao">Cacao</option>
                  <option value="Café">Café</option>
                  <option value="Maíz">Maíz</option>
                  <option value="Soya">Soya</option>
                  <option value="Arroz">Arroz</option>
                  <option value="Girasol">Girasol</option>
                  <option value="Aguacate">Aguacate</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-field">
                <label>Variedad / Clon</label>
                <input value={form.variedad} onChange={e=>handleChange('variedad', e.target.value)} placeholder="Ej. CCN51, Castillo"/>
              </div>
              <div className="form-field">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={e=>handleChange('fecha', e.target.value)} required/>
              </div>
              <div className="form-field">
                <label>Hora</label>
                <input type="time" value={form.hora} onChange={e=>handleChange('hora', e.target.value)}/>
              </div>
            </div>
          </div>

          {/* Productiva */}
          <div className="form-section">
            <h4><Leaf size={14}/> Información productiva</h4>
            <div className="form-grid">
              <div className="form-field">
                <label>Área cosechada (ha) *</label>
                <input type="number" step="0.01" min="0.01" value={form.area_cosechada} onChange={e=>handleChange('area_cosechada', e.target.value)} placeholder="Ej. 1.80" required/>
              </div>
              <div className="form-field">
                <label>Cantidad cosechada *</label>
                <div style={{display:'flex', gap:6}}>
                  <input type="number" step="0.1" min="0.1" value={form.cantidad} onChange={e=>handleChange('cantidad', e.target.value)} placeholder="Ej. 2450" required style={{flex:1}}/>
                  <select value={form.unidad} onChange={e=>handleChange('unidad', e.target.value)} style={{width:80}}>
                    <option value="kg">kg</option>
                    <option value="T">T</option>
                    <option value="qq">qq</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Número de plantas (opcional)</label>
                <input type="number" min="0" value={form.numero_plantas} onChange={e=>handleChange('numero_plantas', e.target.value)} placeholder="Ej. 1200"/>
              </div>
              <div className="form-field">
                <label>Rendimiento</label>
                <div className="rendimiento-badge">{rendimiento>0 ? `${Math.round(rendimiento).toLocaleString('es-CO')} kg/ha` : '—'}</div>
                <div style={{fontSize:10, color:'var(--text-muted)', marginTop:4}}>Calculado: cantidad / área</div>
              </div>
              <div className="form-field" style={{gridColumn:'1 / span 2'}}>
                <label>Observaciones</label>
                <textarea rows={2} value={form.observaciones} onChange={e=>handleChange('observaciones', e.target.value)} placeholder="Condiciones de cosecha, estado del lote..."/>
              </div>
            </div>
          </div>

          {/* Responsable */}
          <div className="form-section">
            <h4><Users size={14}/> Responsable</h4>
            <div className="form-grid">
              <div className="form-field">
                <label>Responsable de cosecha</label>
                <select value={form.responsable} onChange={e=>handleChange('responsable', e.target.value)}>
                  <option value="">Seleccionar</option>
                  {trabajadores.map(t=> <option key={t.id} value={`${t.nombres} ${t.apellidos}`.trim()}>{t.nombres} {t.apellidos}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Cuadrilla (opcional)</label>
                <input value={form.cuadrilla} onChange={e=>handleChange('cuadrilla', e.target.value)} placeholder="Nombre cuadrilla"/>
              </div>
            </div>
          </div>

          {/* GPS */}
          <div className="form-section">
            <h4><Crosshair size={14}/> Georreferenciación</h4>
            <div className="form-grid">
              <div className="form-field">
                <label>Latitud</label>
                <input value={form.latitud} onChange={e=>handleChange('latitud', e.target.value)} placeholder="Ej. 4.60971"/>
              </div>
              <div className="form-field">
                <label>Longitud</label>
                <input value={form.longitud} onChange={e=>handleChange('longitud', e.target.value)} placeholder="Ej. -74.08175"/>
              </div>
              <div className="form-field">
                <label>Precisión GPS (m)</label>
                <input value={form.precision_gps} onChange={e=>handleChange('precision_gps', e.target.value)} placeholder="Auto"/>
              </div>
              <div className="form-field" style={{display:'flex', alignItems:'flex-end'}}>
                <button type="button" onClick={handleGps} disabled={gpsLoading} style={{width:'100%', padding:'8px', borderRadius:8, border:'1px solid var(--primary-border)', background:'var(--primary-light)', color:'var(--primary)', fontWeight:600, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                  {gpsLoading ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Crosshair size={14}/>} {gpsLoading? 'Capturando...':'Capturar GPS'}
                </button>
              </div>
            </div>
            <div style={{fontSize:10, color:'var(--text-muted)', marginTop:6}}>La captura GPS es opcional pero recomendada para trazabilidad.</div>
          </div>

          {error && <div style={{padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:8, fontSize:12}}>{error}</div>}

          <div style={{display:'flex', gap:10, marginTop:4}}>
            <button type="button" onClick={onClose} style={{flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--border-color)', background:'white', fontWeight:600, cursor:'pointer'}}>Cancelar</button>
            <button type="submit" disabled={saving} style={{flex:1, padding:'10px', borderRadius:8, border:'none', background:'#15803d', color:'white', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              {saving && <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>} {saving? 'Guardando...':'Registrar Cosecha'}
            </button>
          </div>
          <div style={{fontSize:10, color:'var(--text-muted)', textAlign:'center'}}>El código COS-2026-000001 se generará automáticamente en backend y será el inicio de la trazabilidad.</div>
        </form>
      </div>
    </div>
  );
}
export default HarvestForm;
