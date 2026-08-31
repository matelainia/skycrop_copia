import { memo, useState, useRef, useEffect } from 'react';
import { FileText, Eye, MoreVertical } from 'lucide-react';

const SoilRow = memo(function SoilRow({ analisis, onAction, isSelected = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleAction = (key) => {
    setMenuOpen(false);
    onAction?.(key, analisis);
  };

  return (
    <tr className={`soil-table__row soil-table__row--enter ${isSelected ? 'soil-table__row--selected' : ''}`}>
      {/* Fecha de análisis */}
      <td className="soil-table__td">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: isSelected ? '#D1FAE5' : '#F3F4F6',
            border: `1px solid ${isSelected ? '#A7F3D0' : '#E5E7EB'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isSelected ? '#059669' : '#6B7280', flexShrink: 0
          }}>
            <FileText size={14} />
          </div>
          <div>
            <div className="soil-date-cell__date">{analisis.fechaAnalisisFormatted}</div>
            {analisis.codigoMuestra && <div className="soil-date-cell__ago" style={{ fontSize: 11 }}>{analisis.codigoMuestra}</div>}
          </div>
        </div>
      </td>

      {/* Lote / Sector */}
      <td className="soil-table__td">
        <div className="soil-lote__name">{analisis.loteNombre}</div>
        <div className="soil-lote__farm">{analisis.predioNombre}{analisis.cultivo && analisis.cultivo !== '—' ? ` · ${analisis.cultivo}` : ''}</div>
      </td>

      {/* Zona de muestreo */}
      <td className="soil-table__td">
        <div className="soil-zona__name">{analisis.zonaMuestreo || analisis.ubicacionNombre || '—'}</div>
        <div className="soil-zona__desc">{analisis.zonaDescripcion || (analisis.hasGps ? 'Con GPS' : 'Área productiva')}</div>
      </td>

      {/* Laboratorio */}
      <td className="soil-table__td">
        <div className="soil-lab__name">{analisis.laboratorioNombre}</div>
        <div className="soil-lab__cert">{analisis.laboratorioCert ? `Cert. ${analisis.laboratorioCert}` : (analisis.laboratorioAcreditado ? 'Acreditado' : '—')}</div>
      </td>

      {/* Parámetros principales */}
      <td className="soil-table__td">
        {analisis.resultadosPreview && analisis.resultadosPreview.length > 0 ? (
          <div className="soil-params">
            {analisis.resultadosPreview.slice(0, 3).map((p) => (
              <span key={p.codigo} className="soil-param-pill">
                {p.codigo} {Number(p.valor).toFixed(p.codigo === 'pH' ? 1 : 2)}{p.unidad !== '-' ? ` ${p.unidad}` : ''}
              </span>
            ))}
            {analisis.resultadosCount > 3 && (
              <span className="soil-param-pill--more">+{analisis.resultadosCount - 3} más</span>
            )}
          </div>
        ) : (
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>Sin resultados</span>
        )}
      </td>

      {/* Acciones */}
      <td className="soil-table__td soil-table__td--actions">
        <div className="soil-row-actions">
          <button
            type="button"
            className="fert-btn fert-btn--ghost fert-btn--icon"
            onClick={() => handleAction('view')}
            aria-label={`Ver análisis ${analisis.loteNombre}`}
            title="Ver detalle"
            style={{ border: '1px solid #E5E7EB', background: '#fff' }}
          >
            <Eye size={14} style={{ color: '#059669' }} />
          </button>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="fert-btn fert-btn--ghost fert-btn--icon"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="actions-dropdown__menu"
                style={{ right: 0, minWidth: 220 }}
              >
                <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('view')}>
                  <Eye size={14} /> Ver análisis
                </button>
                <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('edit')}>
                  ✎ Editar
                </button>
                {analisis.hasPdf && (
                  <>
                    <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('viewPdf')}>
                      📄 Ver PDF
                    </button>
                    <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('downloadPdf')}>
                      ⬇ Descargar PDF
                    </button>
                  </>
                )}
                {analisis.hasGps && (
                  <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('viewLocation')}>
                    📍 Ver ubicación
                  </button>
                )}
                <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('duplicate')}>
                  ⧉ Duplicar información
                </button>
                <div className="actions-dropdown__separator" />
                <button role="menuitem" className="actions-dropdown__item" onClick={() => handleAction('archive')}>
                  Archivar
                </button>
                <button role="menuitem" className="actions-dropdown__item actions-dropdown__item--danger" onClick={() => handleAction('delete')}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});

export default SoilRow;
