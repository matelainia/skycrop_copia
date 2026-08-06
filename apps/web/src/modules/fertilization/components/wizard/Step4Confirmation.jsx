import { CheckCircle2, UploadCloud, Paperclip } from 'lucide-react';
import { formatCOP } from '../../../../utils/format.js';


export default function Step4Confirmation({ data, setData, totalBudget }) {
  const updateConfirmation = (field, value) => {
    setData(d => ({
      ...d,
      confirmation: { ...d.confirmation, [field]: value },
    }));
  };

  const handleFileDrop = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      updateConfirmation('attachments', [
        ...data.confirmation.attachments,
        ...files.map(f => f.name),
      ]);
    }
  };

  return (
    <div className="step-pane">
      <div className="step-pane-header">
        <div className="step-icon-badge success">
          <CheckCircle2 size={18} />
        </div>
        <div>
          <h3>Confirmación y guardado</h3>
          <p>Verifica el resumen antes de crear el plan de fertilización</p>
        </div>
      </div>

      {/* Grid de Resumen */}
      <div className="confirmation-summary-grid">
        <div className="summary-box">
          <span className="box-label">NOMBRE</span>
          <span className="box-value highlight">{data.general.name || '—'}</span>
        </div>
        <div className="summary-box">
          <span className="box-label">RESPONSABLE</span>
          <span className="box-value">{data.general.responsibleName || 'Sebastián Díaz'}</span>
        </div>
        <div className="summary-box">
          <span className="box-label">LOTE</span>
          <span className="box-value">{data.general.lotName || 'Lote 12 - El Paraíso'}</span>
        </div>

        <div className="summary-box">
          <span className="box-label">SECTOR</span>
          <span className="box-value">{data.general.sector || 'Sector Norte'}</span>
        </div>
        <div className="summary-box">
          <span className="box-label">ÁREA</span>
          <span className="box-value">{data.general.area || 4.5} ha</span>
        </div>
        <div className="summary-box">
          <span className="box-label">VIGENCIA</span>
          <span className="box-value">
            {data.general.startDate} → {data.general.endDate}
          </span>
        </div>

        <div className="summary-box">
          <span className="box-label">CULTIVO</span>
          <span className="box-value">{data.crop.cropName} ({data.crop.cropScientific})</span>
        </div>
        <div className="summary-box">
          <span className="box-label">ETAPA</span>
          <span className="box-value">{data.crop.stage}</span>
        </div>
        <div className="summary-box">
          <span className="box-label">DENSIDAD</span>
          <span className="box-value">{data.crop.density} árboles/ha</span>
        </div>

        <div className="summary-box">
          <span className="box-label">SUELO</span>
          <span className="box-value">{data.crop.soilType}</span>
        </div>
        <div className="summary-box">
          <span className="box-label">PH OBJ.</span>
          <span className="box-value">{data.crop.targetPh}</span>
        </div>
        <div className="summary-box">
          <span className="box-label">APLICACIONES</span>
          <span className="box-value highlight text-green">
            {data.applications.length} – {formatCOP(totalBudget)}
          </span>
        </div>
      </div>

      {/* Observaciones */}
      <div className="form-group full-width mt-4">
        <label className="form-label">OBSERVACIONES</label>
        <textarea
          rows={3}
          className="form-textarea"
          placeholder="Notas de campo, restricciones de aplicación, acuerdos con el equipo..."
          value={data.confirmation.observations}
          onChange={e => updateConfirmation('observations', e.target.value)}
        />
      </div>

      {/* Adjuntos de campo */}
      <div className="form-group full-width">
        <label className="form-label">ADJUNTOS DE CAMPO</label>
        <div className="dropzone-box">
          <UploadCloud size={24} className="dropzone-icon" />
          <p className="dropzone-text">
            Arrastra archivos de análisis de suelo o fotos del lote aquí o{' '}
            <label className="dropzone-link">
              selecciona de tu equipo
              <input type="file" multiple className="sr-only" onChange={handleFileDrop} />
            </label>
          </p>
          <span className="dropzone-hint">Formatos soportados: PDF, PNG, JPG (máx. 10MB)</span>
        </div>

        {data.confirmation.attachments.length > 0 && (
          <div className="attachments-list mt-2">
            {data.confirmation.attachments.map((att, i) => (
              <span key={i} className="attachment-chip">
                <Paperclip size={12} /> {att}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
