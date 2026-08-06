import { Plus, Sparkles, Trash2, Calendar } from 'lucide-react';
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

  const suggestPlan = () => {
    const stage = data.crop.stage || 'Llenado';
    const template = SUGGESTED_PLANS[stage] || SUGGESTED_PLANS.Llenado;
    const now = Date.now();
    const apps = template.map(t => ({
      productId: t.productId,
      dose: t.dose,
      date: new Date(now + t.daysOffset * 86400000).toISOString().slice(0, 10),
      method: t.method,
      cost: t.cost,
    }));
    setData(d => ({ ...d, applications: apps }));
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
          <button onClick={suggestPlan} className="btn btn-soft">
            <Sparkles size={14} /> Sugerir plan base
          </button>
          <button onClick={addApplication} className="btn btn-ghost">
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
    </div>
  );
}
