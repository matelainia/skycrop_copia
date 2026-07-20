import React from 'react';
import { X } from 'lucide-react';
import SeveritySelect from './SeveritySelect';
import VariableEvidence from './VariableEvidence';

/** Mapa icono por categoría de objeto de evaluación */
const CATEGORY_ICONS = {
  'Insecto':                '🐛',
  'Ácaro':                  '🕷️',
  'Nematodo':               '🔬',
  'Molusco':                '🐌',
  'Mamífero':               '🐾',
  'Maleza':                 '🌿',
  'Enfermedad Fúngica':     '🍄',
  'Enfermedad Bacteriana':  '🦠',
  'Enfermedad Viral':       '🧬',
  'Deficiencia Nutricional':'🍃',
  'Daño Abiótico':          '💨',
  'Variable Productiva':    '📊',
  'Otro':                   '🔍',
};

/** Color de icono por relevancia */
const RELEVANCIA_COLORS = {
  critica: '#fecaca',
  alta:    '#fed7aa',
  normal:  '#d1fae5',
  baja:    '#e2e8f0',
};

/**
 * VariableCard
 * Fila premium dentro de la tabla de variables a evaluar.
 *
 * @param {{
 *   objeto: Object,
 *   valor: { severity: string, observation: string, photos: string[] },
 *   onChange: (campo, valor) => void,
 *   onPhotoAdd: (file: File) => void,
 *   onPhotoRemove: (idx: number) => void,
 *   onPhotoPreview: (idx: number) => void,
 *   onRemove: () => void,
 *   showRemove?: boolean
 * }} props
 */
const VariableCard = ({
  objeto,
  valor = { severity: 'absent', observation: '', photos: [] },
  onChange,
  onPhotoAdd,
  onPhotoRemove,
  onPhotoPreview,
  onRemove,
  showRemove = true,
}) => {
  const icon = CATEGORY_ICONS[objeto.categoria] || '🔍';
  const iconBg = RELEVANCIA_COLORS[objeto.relevancia] || '#e2e8f0';

  // Extraer escala del protocolo si existe (tipo 'scale')
  const scaleVar = objeto.protocolo?.variables?.find(v => v.tipo === 'scale');
  const scaleOptions = scaleVar?.escala || null;

  return (
    <div className="eval-variable-row">

      {/* Columna 1: Identidad */}
      <div className="eval-var-identity">
        <div className="eval-var-icon" style={{ background: iconBg }}>
          {icon}
        </div>
        <div>
          <div className="eval-var-name">{objeto.nombre_comun}</div>
          {objeto.nombre_cientifico && (
            <div className="eval-var-desc" style={{ fontStyle: 'italic' }}>
              {objeto.nombre_cientifico}
            </div>
          )}
          <div className="eval-var-desc">{objeto.descripcion?.slice(0, 60)}{objeto.descripcion?.length > 60 ? '…' : ''}</div>
        </div>
      </div>

      {/* Columna 2: Escala / Unidad */}
      <div className="eval-var-scale">
        {scaleOptions ? (
          <>
            <div className="eval-var-scale-range">
              0 – {scaleOptions.length - 1}
            </div>
            <div className="eval-var-scale-type">Escala</div>
          </>
        ) : objeto.protocolo?.variables?.[0] ? (
          <>
            <div className="eval-var-scale-range">
              {objeto.protocolo.variables[0].min ?? '—'} – {objeto.protocolo.variables[0].max ?? '—'}
            </div>
            <div className="eval-var-scale-type">
              {objeto.protocolo.variables[0].unidad || objeto.protocolo.variables[0].tipo}
            </div>
          </>
        ) : (
          <div className="eval-var-scale-type" style={{ color: 'var(--text-muted)' }}>
            Sin protocolo
          </div>
        )}
      </div>

      {/* Columna 3: Valor observado (SeveritySelect) */}
      <div>
        <SeveritySelect
          value={valor.severity || 'absent'}
          onChange={(v) => onChange('severity', v)}
          scaleOptions={scaleOptions}
        />
      </div>

      {/* Columna 4: Observaciones */}
      <div>
        <textarea
          className="eval-obs-textarea"
          placeholder="Notas de campo…"
          value={valor.observation || ''}
          onChange={(e) => onChange('observation', e.target.value)}
          rows={2}
        />
      </div>

      {/* Columna 5: Evidencia */}
      <div>
        <VariableEvidence
          photos={valor.photos || []}
          onAdd={onPhotoAdd}
          onRemove={onPhotoRemove}
          onPreview={onPhotoPreview}
        />
      </div>

      {/* Columna 6: Eliminar */}
      {showRemove && (
        <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
          <button
            type="button"
            onClick={onRemove}
            className="eval-evidence-btn danger"
            title="Eliminar variable"
            aria-label="Eliminar variable"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default VariableCard;
