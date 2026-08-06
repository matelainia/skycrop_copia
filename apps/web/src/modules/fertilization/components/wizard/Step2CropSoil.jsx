import { Sprout } from 'lucide-react';

export default function Step2CropSoil({ data, setData, errors, masterData = {} }) {
  const { soilAnalyses = [] } = masterData;

  const updateCrop = (field, value) => {
    setData(d => ({
      ...d,
      crop: { ...d.crop, [field]: value },
    }));
  };

  return (
    <div className="step-pane">
      <div className="step-pane-header">
        <div className="step-icon-badge">
          <Sprout size={18} />
        </div>
        <div>
          <h3>Cultivo y condiciones de suelo</h3>
          <p>Base agronómica para las recomendaciones nutricionales</p>
        </div>
      </div>

      <div className="form-grid">
        {/* Cultivo */}
        <div className="form-group">
          <label className="form-label">
            CULTIVO <span className="required">*</span>
          </label>
          <select
            className={`form-select ${errors.cropName ? 'has-error' : ''}`}
            value={data.crop.cropName}
            onChange={e => updateCrop('cropName', e.target.value)}
          >
            <option value="Cacao">Cacao (Theobroma cacao)</option>
            <option value="Café">Café (Coffea arabica)</option>
            <option value="Palma de Aceite">Palma de Aceite (Elaeis guineensis)</option>
            <option value="Aguacate">Aguacate Hass (Persea americana)</option>
          </select>
          {errors.cropName && <span className="error-text">{errors.cropName}</span>}
        </div>

        {/* Etapa Fenológica */}
        <div className="form-group">
          <label className="form-label">
            ETAPA FENOLÓGICA <span className="required">*</span>
          </label>
          <select
            className={`form-select ${errors.stage ? 'has-error' : ''}`}
            value={data.crop.stage}
            onChange={e => updateCrop('stage', e.target.value)}
          >
            <option value="Llenado">Llenado de fruto / grano</option>
            <option value="Floración">Floración y cuaje</option>
            <option value="Desarrollo">Desarrollo vegetativo</option>
            <option value="Mantenimiento">Mantenimiento post-cosecha</option>
          </select>
          {errors.stage && <span className="error-text">{errors.stage}</span>}
        </div>

        {/* Densidad */}
        <div className="form-group">
          <label className="form-label">DENSIDAD (ÁRBOLES/HA)</label>
          <input
            type="number"
            className="form-input"
            value={data.crop.density}
            onChange={e => updateCrop('density', parseInt(e.target.value) || 0)}
          />
        </div>

        {/* Tipo de suelo (Permite escribir manualmente) */}
        <div className="form-group">
          <label className="form-label">TIPO DE SUELO</label>
          <input
            type="text"
            className="form-input"
            list="soil-types-suggestions"
            placeholder="Escribe o selecciona un tipo de suelo"
            value={data.crop.soilType || ''}
            onChange={e => updateCrop('soilType', e.target.value)}
          />
          <datalist id="soil-types-suggestions">
            <option value="Franco-arcilloso" />
            <option value="Franco-arenoso" />
            <option value="Arcilloso" />
            <option value="Arenoso" />
            <option value="Limoso" />
            <option value="Franco" />
            <option value="Orgánico / Turba" />
          </datalist>
        </div>

        {/* pH Objetivo */}
        <div className="form-group">
          <label className="form-label">PH OBJETIVO</label>
          <input
            type="number"
            step="0.1"
            className="form-input"
            value={data.crop.targetPh}
            onChange={e => updateCrop('targetPh', parseFloat(e.target.value) || 6.0)}
          />
        </div>

        {/* Último análisis de suelo (Datos reales previamente cargados) */}
        <div className="form-group full-width">
          <label className="form-label">ÚLTIMO ANÁLISIS DE SUELO</label>
          <select
            className="form-select"
            value={data.crop.lastAnalysisId || ''}
            onChange={e => updateCrop('lastAnalysisId', e.target.value)}
          >
            <option value="">Sin análisis reciente registrado</option>
            {soilAnalyses.map(analysis => (
              <option key={analysis.id} value={analysis.id}>
                {analysis.label}
              </option>
            ))}
          </select>
          <span className="form-hint">
            ⓘ Los valores de referencia nutricional se tomarán automáticamente de este análisis.
          </span>
        </div>
      </div>
    </div>
  );
}

