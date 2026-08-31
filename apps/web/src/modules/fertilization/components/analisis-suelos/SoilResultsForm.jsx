import { memo, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const SoilResultsForm = memo(function SoilResultsForm({
  results = [],
  parametros = [],
  onChange,
  disabled = false,
}) {
  const [newCodigo, setNewCodigo] = useState('');

  const handleChange = useCallback((idx, field, value) => {
    const next = results.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    onChange?.(next);
  }, [results, onChange]);

  const handleRemove = useCallback((idx) => {
    const next = results.filter((_, i) => i !== idx);
    onChange?.(next);
  }, [results, onChange]);

  const handleAdd = useCallback(() => {
    if (!newCodigo) return;
    const param = parametros.find((p) => p.codigo === newCodigo);
    if (!param) return;
    // Evitar duplicados
    if (results.some((r) => r.codigo_parametro === newCodigo)) {
      setNewCodigo('');
      return;
    }
    const next = [
      ...results,
      {
        codigo_parametro: param.codigo,
        parametro: param.nombre,
        valor: '',
        unidad: param.unidad_default || '-',
        metodo_analitico: '',
        nivel_interpretacion: '',
        observacion: '',
        orden: results.length,
      },
    ];
    onChange?.(next);
    setNewCodigo('');
  }, [newCodigo, parametros, results, onChange]);

  // Opciones disponibles (no duplicadas)
  const available = parametros.filter((p) => !results.some((r) => r.codigo_parametro === p.codigo));

  return (
    <div className="soil-results-form">
      {results.length === 0 ? (
        <div style={{ padding: 16, borderRadius: 12, border: '1px dashed #E5E7EB', background: '#F9FAFB', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
          No hay parámetros registrados. Agrega los resultados del laboratorio.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.7fr 0.9fr 32px', gap: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280' }}>
            <span>Parámetro</span>
            <span>Valor</span>
            <span>Unidad</span>
            <span>Interpretación</span>
            <span />
          </div>
          {results.map((r, idx) => (
            <div key={`${r.codigo_parametro}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.7fr 0.9fr 32px', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                <div>{r.codigo_parametro}</div>
                <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 400 }}>{r.parametro || r.codigo_parametro}</div>
              </div>
              <input
                type="number"
                step="0.01"
                value={r.valor ?? ''}
                onChange={(e) => handleChange(idx, 'valor', e.target.value)}
                placeholder="6.2"
                className="soil-form__input"
                disabled={disabled}
                style={{ padding: '7px 10px', fontSize: 12 }}
              />
              <input
                type="text"
                value={r.unidad ?? ''}
                onChange={(e) => handleChange(idx, 'unidad', e.target.value)}
                placeholder="mg/kg"
                className="soil-form__input"
                disabled={disabled}
                style={{ padding: '7px 10px', fontSize: 12 }}
              />
              <select
                value={r.nivel_interpretacion || ''}
                onChange={(e) => handleChange(idx, 'nivel_interpretacion', e.target.value)}
                className="soil-form__select"
                disabled={disabled}
                style={{ padding: '7px 10px', fontSize: 12 }}
              >
                <option value="">—</option>
                <option value="muy_bajo">Muy bajo</option>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="optimo">Óptimo</option>
                <option value="alto">Alto</option>
                <option value="muy_alto">Muy alto</option>
              </select>
              <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={() => handleRemove(idx)} disabled={disabled} aria-label="Eliminar parámetro">
                <Trash2 size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <select
          value={newCodigo}
          onChange={(e) => setNewCodigo(e.target.value)}
          className="soil-form__select"
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <option value="">Seleccionar parámetro</option>
          {available.map((p) => (
            <option key={p.codigo} value={p.codigo}>{p.codigo} · {p.nombre} {p.unidad_default !== '-' ? `(${p.unidad_default})` : ''}</option>
          ))}
        </select>
        <button
          type="button"
          className="fert-btn fert-btn--outline"
          onClick={handleAdd}
          disabled={disabled || !newCodigo}
          style={{ fontSize: 12 }}
        >
          <Plus size={14} /> Agregar parámetro
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#6B7280' }}>
        Los resultados se guardan como filas estructuradas y alimentarán la Calculadora de Fertilización sin re-digitar.
      </div>
    </div>
  );
});

export default SoilResultsForm;
