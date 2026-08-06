import { MapPin } from 'lucide-react';

export default function Step1GeneralInfo({ data, setData, errors, masterData, selectLote }) {
  const { lotes = [], responsables = [] } = masterData || {};

  const updateGeneral = (field, value) => {
    setData(d => ({
      ...d,
      general: { ...d.general, [field]: value },
    }));
  };

  return (
    <div className="step-pane">
      <div className="step-pane-header">
        <div className="step-icon-badge">
          <MapPin size={18} />
        </div>
        <div>
          <h3>Información general del plan</h3>
          <p>Ubicación, responsable y vigencia del plan</p>
        </div>
      </div>

      <div className="form-grid">
        {/* Nombre del plan */}
        <div className="form-group full-width">
          <label className="form-label">
            NOMBRE DEL PLAN <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.name ? 'has-error' : ''}`}
            placeholder="Ej: Plan Fertilización Cacao Q4"
            value={data.general.name}
            onChange={e => updateGeneral('name', e.target.value)}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        {/* Responsable */}
        <div className="form-group">
          <label className="form-label">RESPONSABLE</label>
          <select
            className="form-select"
            value={data.general.responsibleId}
            onChange={e => {
              const selectedOption = e.target.options[e.target.selectedIndex].text;
              setData(d => ({
                ...d,
                general: {
                  ...d.general,
                  responsibleId: e.target.value,
                  responsibleName: selectedOption,
                },
              }));
            }}
          >
            {responsables.length === 0 ? (
              <option value="">Cargando personal de la empresa...</option>
            ) : (
              responsables.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.role ? `(${r.role})` : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Predio / Lote */}
        <div className="form-group">
          <label className="form-label">
            PREDIO / LOTE <span className="required">*</span>
          </label>
          <select
            className={`form-select ${errors.lotId ? 'has-error' : ''}`}
            value={data.general.lotId}
            onChange={e => {
              if (selectLote) {
                selectLote(e.target.value);
              } else {
                const selectedOption = e.target.options[e.target.selectedIndex].text;
                setData(d => ({
                  ...d,
                  general: {
                    ...d.general,
                    lotId: e.target.value,
                    lotName: selectedOption,
                  },
                }));
              }
            }}
          >
            <option value="">Seleccionar Lote de Supabase...</option>
            {lotes.map(l => (
              <option key={l.id} value={l.id}>
                {l.nombre} {l.codigo_interno ? `(${l.codigo_interno})` : ''} — {l.area_ha || 0} ha
              </option>
            ))}
          </select>
          {errors.lotId && <span className="error-text">{errors.lotId}</span>}
        </div>

        {/* Sector */}
        <div className="form-group">
          <label className="form-label">SECTOR</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ej: Sector Norte"
            value={data.general.sector}
            onChange={e => updateGeneral('sector', e.target.value)}
          />
        </div>

        {/* Área (HA) */}
        <div className="form-group">
          <label className="form-label">
            ÁREA (HA) <span className="required">*</span>
          </label>
          <input
            type="number"
            step="0.1"
            className={`form-input ${errors.area ? 'has-error' : ''}`}
            value={data.general.area}
            onChange={e => updateGeneral('area', parseFloat(e.target.value) || 0)}
          />
          {errors.area && <span className="error-text">{errors.area}</span>}
        </div>

        {/* Vigencia Inicio */}
        <div className="form-group">
          <label className="form-label">INICIO DE VIGENCIA</label>
          <input
            type="date"
            className="form-input"
            value={data.general.startDate}
            onChange={e => updateGeneral('startDate', e.target.value)}
          />
        </div>

        {/* Vigencia Fin */}
        <div className="form-group">
          <label className="form-label">FIN DE VIGENCIA</label>
          <input
            type="date"
            className="form-input"
            value={data.general.endDate}
            onChange={e => updateGeneral('endDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
