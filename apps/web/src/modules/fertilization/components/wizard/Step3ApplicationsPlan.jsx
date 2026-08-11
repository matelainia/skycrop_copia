import { useState } from 'react';
import { Plus, Sparkles, Trash2, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { PRODUCTS_CATALOG, NUTRIENT_BADGE_MAP } from '../../constants/products.js';
import { formatCOP } from '../../../../utils/format.js';


const SUGGESTED_PLANS = {
  Llenado: [
    { productId: 'kcl', dose: 150, method: 'suelo', cost: 1350000, daysOffset: 7 },
    { productId: 'urea', dose: 100, method: 'suelo', cost: 980000, daysOffset: 21 },
    { productId: 'dap', dose: 80, method: 'suelo', cost: 1150000, daysOffset: 35 },
    { productId: 'foliar-20-20-20', dose: 3, method: 'foliar', cost: 420000, daysOffset: 49 },
  ],
  Floración: [
    { productId: 'dap', dose: 100, method: 'suelo', cost: 1200000, daysOffset: 3 },
    { productId: 'urea', dose: 80, method: 'suelo', cost: 850000, daysOffset: 15 },
    { productId: 'foliar-boro', dose: 2, method: 'foliar', cost: 380000, daysOffset: 25 },
  ],
};

export default function Step3ApplicationsPlan({ data, setData, errors, masterData }) {
  const { getToken } = useAuth();
  const [generandoPlan, setGenerandoPlan] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const dbProductos = masterData?.productos || [];
  const productsList = dbProductos.length > 0
    ? dbProductos.map(p => ({
        id: p.id,
        name: p.nombre_producto || p.nombre,
        typeNut: p.clase_producto === 'fertilizante_foliar' ? 'Fol' : p.clase_producto === 'organico' ? 'Org' : 'N-P',
      }))
    : PRODUCTS_CATALOG;

  const totalBudget = data.applications.reduce((sum, a) => sum + (Number(a.cost) || 0), 0);


  const addApplication = () => {
    setData(d => ({
      ...d,
      applications: [
        ...d.applications,
        { productId: 'kcl', dose: 50, date: new Date().toISOString().slice(0, 10), method: 'suelo', cost: 450000 },
      ],
    }));
  };

  const suggestPlan = async () => {
    setGenerandoPlan(true);
    setToast(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const token = await getToken();
      
      const payload = {
        cultivo: data.crop.cropName || 'Cacao',
        areaHa: Number(data.general.area) || 1,
        region: data.general.sector || 'Tolima',
        etapa: data.crop.stage || 'Llenado',
        fechaInicio: data.general.startDate,
        presupuestoMax: undefined
      };

      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/v1/fertilizacion/sugerir-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-Id': crypto.randomUUID()
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        let errorMsg = 'Error al generar el plan';
        if (json) {
          if (typeof json.error === 'string') {
            errorMsg = json.error;
          } else if (json.error && typeof json.error.message === 'string') {
            errorMsg = json.error.message;
          } else if (typeof json.message === 'string') {
            errorMsg = json.message;
          }
        }
        throw new Error(errorMsg);
      }

      if (json && json.data && json.data.aplicaciones) {
        const apps = json.data.aplicaciones.map(a => ({
          productId: a.productoId,
          dose: a.dosis,
          date: a.fecha,
          method: a.metodo || 'suelo',
          cost: a.costo,
        }));
        setData(d => ({ ...d, applications: apps }));
        showToast('Plan base generado por IA exitosamente.', 'success');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('La IA tardó demasiado en responder (timeout).', 'error');
      } else {
        const msg = typeof err === 'object' && err?.message && err.message !== '[object Object]' 
          ? err.message 
          : typeof err === 'string' 
          ? err 
          : 'Hubo un error contactando a la IA.';
        showToast(msg, 'error');
      }
    } finally {
      setGenerandoPlan(false);
    }
  };

  const updateApp = (idx, field, value) => {
    setData(d => {
      const apps = [...d.applications];
      apps[idx] = { ...apps[idx], [field]: value };
      return { ...d, applications: apps };
    });
  };

  const removeApp = (idx) => {
    setData(d => ({ ...d, applications: d.applications.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="step-pane">
      <div className="step-pane-header">
        <div className="step-icon-badge">
          <Calendar size={18} />
        </div>
        <div>
          <h3>Aplicaciones del plan</h3>
          <p>Define productos, dosis, fechas y costos por aplicación</p>
        </div>
      </div>

      <div className="apps-toolbar">
        <span className="toolbar-title">Cronograma de aplicaciones *</span>
        <div className="toolbar-actions">
          <button onClick={suggestPlan} disabled={generandoPlan} className="btn btn-soft">
            {generandoPlan ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} 
            {generandoPlan ? ' Generando plan...' : ' Sugerir plan base'}
          </button>
          <button onClick={addApplication} disabled={generandoPlan} className="btn btn-ghost">
            <Plus size={14} /> Agregar aplicación
          </button>
        </div>
      </div>

      {errors.applications && (
        <div className="error-banner">{errors.applications}</div>
      )}

      <div className="apps-list">
        {data.applications.map((app, idx) => {
          const productObj = PRODUCTS_CATALOG.find(p => p.id === app.productId);
          const badgeInfo = productObj ? NUTRIENT_BADGE_MAP[productObj.typeNut] : null;

          return (
            <div key={idx} className="app-row-card">
              {/* Badge nutricional */}
              <div className="app-badge-col">
                {badgeInfo && (
                  <span className={`nut-badge ${badgeInfo.class}`}>{productObj.typeNut}</span>
                )}
              </div>

              {/* Producto */}
              <div className="app-field-col flex-2">
                <label className="row-label">PRODUCTO</label>
                <select
                  className="form-select input-sm"
                  value={app.productId}
                  onChange={e => updateApp(idx, 'productId', e.target.value)}
                >
                  <option value="">Seleccionar producto...</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

              </div>

              {/* Dosis */}
              <div className="app-field-col">
                <label className="row-label">DOSIS (KG/HA)</label>
                <input
                  type="number"
                  className="form-input input-sm"
                  placeholder="Dosis"
                  value={app.dose}
                  onChange={e => updateApp(idx, 'dose', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Fecha */}
              <div className="app-field-col">
                <label className="row-label">FECHA</label>
                <input
                  type="date"
                  className="form-input input-sm"
                  value={app.date}
                  onChange={e => updateApp(idx, 'date', e.target.value)}
                />
              </div>

              {/* Método */}
              <div className="app-field-col">
                <label className="row-label">MÉTODO</label>
                <select
                  className="form-select input-sm"
                  value={app.method}
                  onChange={e => updateApp(idx, 'method', e.target.value)}
                >
                  <option value="suelo">Al suelo</option>
                  <option value="foliar">Foliar</option>
                </select>
              </div>

              {/* Costo */}
              <div className="app-field-col">
                <label className="row-label">COSTO ESTIMADO</label>
                <input
                  type="number"
                  className="form-input input-sm"
                  placeholder="Costo"
                  value={app.cost}
                  onChange={e => updateApp(idx, 'cost', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Action */}
              <div className="app-action-col">
                <button
                  onClick={() => removeApp(idx)}
                  className="icon-btn icon-btn-danger"
                  aria-label="Eliminar aplicación"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="totals-bar">
        <span>
          Aplicaciones: <strong>{data.applications.length}</strong>
        </span>
        <span>
          Presupuesto total estimado:{' '}
          <strong className="text-green">{formatCOP(totalBudget)}</strong>
        </span>
      </div>

      {toast && (
        <div className="pd-toast-container" role="status" aria-live="polite" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
          <div className={`pd-toast sc-toast pd-toast--${toast.type}`} style={{ padding: '12px 20px', borderRadius: '8px', background: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
