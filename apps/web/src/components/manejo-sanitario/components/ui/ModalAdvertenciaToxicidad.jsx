import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, X, AlertTriangle, CheckCircle, Loader2,
  Skull, Hand, Droplets, Bug, Baby, FileText, Lock, MapPin,
  Shield, Ban
} from 'lucide-react';

function SkullCrossbonesIcon({ size = 38, className = "", style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={{ display: 'block', ...style }}
    >
      <path d="M439.15 453.06L297.17 384l141.99-69.06c7.9-3.95 11.11-13.56 7.15-21.46L432 264.85c-3.95-7.9-13.56-11.11-21.47-7.16L224 348.41 37.47 257.69c-7.9-3.95-17.51-.75-21.47 7.16L1.69 293.48c-3.95 7.9-.75 17.51 7.15 21.46L150.83 384 8.85 453.06c-7.9 3.95-11.11 13.56-7.15 21.47l14.31 28.63c3.95 7.9 13.56 11.11 21.47 7.15L224 419.59l186.53 90.72c7.9 3.95 17.51.75 21.47-7.15l14.31-28.63c3.95-7.91.74-17.52-7.16-21.47zM150 237.28l-5.48 25.87c-2.67 12.62 5.42 24.85 16.45 24.85h126.08c11.03 0 19.12-12.23 16.45-24.85l-5.5-25.87c41.78-22.41 70-62.75 70-109.28C368 57.31 303.53 0 224 0S80 57.31 80 128c0 46.53 28.22 86.87 70 109.28zM280 112c17.65 0 32 14.35 32 32s-14.35 32-32 32-32-14.35-32-32 14.35-32 32-32zm-112 0c17.65 0 32 14.35 32 32s-14.35 32-32 32-32-14.35-32-32 14.35-32 32-32z" />
    </svg>
  );
}

const STYLE_ID = 'modal-toxicidad-keyframes';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes mat-fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes mat-scaleIn {
      from { opacity: 0; transform: scale(0.88) translateY(16px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes mat-pulse-ring {
      0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.45); }
      70%  { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
      100% { box-shadow: 0 0 0 0   rgba(239,68,68,0); }
    }
    @keyframes mat-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function normalizeCategory(raw) {
  const c = String(raw || '').toUpperCase().trim();
  if (['IA', '1A'].includes(c)) return 'IA';
  if (['IB', '1B'].includes(c)) return 'IB';
  return null;
}

export function filtrarIngredientesAltaToxicidad(ingredientesActivos = []) {
  const iaList = ingredientesActivos.filter(i => normalizeCategory(i.cat_toxicologica) === 'IA');
  if (iaList.length > 0) return iaList.map(i => ({ ...i, _catNorm: 'IA' }));

  const ibList = ingredientesActivos.filter(i => normalizeCategory(i.cat_toxicologica) === 'IB');
  if (ibList.length > 0) return ibList.map(i => ({ ...i, _catNorm: 'IB' }));

  return [];
}

function RiskCard({ Icon, title, desc }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '8px', padding: '14px 10px', borderRadius: '12px',
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.18)',
      textAlign: 'center', flex: '1 1 0', minWidth: '90px'
    }}>
      {Icon && <Icon size={22} style={{ color: '#dc2626' }} />}
      <span style={{
        fontSize: '11px', fontWeight: '700', color: '#dc2626',
        lineHeight: '1.3'
      }}>{title}</span>
      {desc && (
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
          {desc}
        </span>
      )}
    </div>
  );
}

function CatBadge({ cat }) {
  const isIA = cat === 'IA';
  return (
    <span style={{
      fontSize: '11px', fontWeight: '800', padding: '3px 10px',
      borderRadius: '6px', letterSpacing: '0.5px', whiteSpace: 'nowrap',
      background: isIA ? 'rgba(127,0,0,0.12)' : 'rgba(239,68,68,0.12)',
      color: isIA ? '#7f0000' : '#b91c1c',
      border: `1px solid ${isIA ? 'rgba(127,0,0,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>
      Cat. {cat}
    </span>
  );
}

export default function ModalAdvertenciaToxicidad({
  ingredientes = [],
  onConfirm,
  onCancel,
  isLoading = false
}) {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geo, setGeo] = useState(null);

  const canConfirm = check1 && check2 && !isLoading;

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const categorias = [...new Set(ingredientes.map(i => i._catNorm))].sort();
  const tieneIA = categorias.includes('IA');

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;

    if (navigator.geolocation && geoStatus === 'idle') {
      setGeoStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          setGeo(geoData);
          setGeoStatus('done');
          onConfirm(geoData);
        },
        () => {
          setGeoStatus('denied');
          onConfirm(null);
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } else {
      onConfirm(geo);
    }
  }, [canConfirm, geoStatus, geo, onConfirm]);

  const handleOverlayClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        animation: 'mat-fadeIn 0.22s ease-out forwards'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '640px',
          maxHeight: '92vh', overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1.5px solid rgba(239,68,68,0.35)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(239,68,68,0.08)',
          animation: 'mat-scaleIn 0.26s cubic-bezier(0.34,1.46,0.64,1) forwards',
          display: 'flex', flexDirection: 'column'
        }}
      >
        <div style={{
          padding: '28px 28px 20px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.04) 100%)',
          borderBottom: '1px solid rgba(239,68,68,0.18)',
          borderRadius: '20px 20px 0 0',
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'rgba(239,68,68,0.12)',
            border: '2px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            animation: 'mat-pulse-ring 2s infinite'
          }}>
            <SkullCrossbonesIcon size={38} style={{ color: '#dc2626' }} />
          </div>

          <h2 style={{
            fontSize: '18px', fontWeight: '800', color: '#dc2626',
            margin: '0 0 8px', lineHeight: '1.3'
          }}>
            Advertencia de Seguridad — Ingredientes de Alta Toxicidad Detectados
          </h2>

          <p style={{
            fontSize: '13px', color: 'var(--text-secondary)', margin: 0,
            lineHeight: '1.55', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto'
          }}>
            Esta prescripción contiene uno o más ingredientes activos clasificados por el{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Instituto Colombiano Agropecuario (ICA)</strong>{' '}
            como <span style={{
              fontWeight: '700', color: '#dc2626',
              background: 'rgba(239,68,68,0.1)', padding: '1px 8px',
              borderRadius: '4px', border: '1px solid rgba(239,68,68,0.25)'
            }}>
              Categoría {categorias.join(' / ')} {tieneIA ? '(Extremadamente Tóxicos)' : '(Altamente Tóxicos)'}
            </span>.
          </p>

          <p style={{
            fontSize: '12.5px', color: 'var(--text-muted)', margin: '10px 0 0',
            lineHeight: '1.5'
          }}>
            Estos productos representan un riesgo elevado para la salud humana y requieren el
            estricto cumplimiento de las medidas de seguridad durante su manipulación y aplicación.
          </p>
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              marginBottom: '10px'
            }}>
              <AlertTriangle size={14} style={{ color: '#dc2626' }} />
              <span style={{
                fontSize: '11px', fontWeight: '700', color: '#dc2626',
                textTransform: 'uppercase', letterSpacing: '0.6px'
              }}>
                Ingredientes detectados
              </span>
            </div>

            <div style={{
              borderRadius: '10px',
              border: '1px solid rgba(239,68,68,0.2)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'rgba(239,68,68,0.06)' }}>
                    <th style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: '0.5px', color: 'var(--text-muted)'
                    }}>Ingrediente Activo</th>
                    <th style={{
                      padding: '9px 14px', textAlign: 'center',
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: '0.5px', color: 'var(--text-muted)'
                    }}>Categoría</th>
                    <th style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: '0.5px', color: 'var(--text-muted)'
                    }}>Producto</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((ing, i) => (
                    <tr key={i} style={{
                      borderTop: '1px solid rgba(239,68,68,0.1)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(239,68,68,0.02)'
                    }}>
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {ing.nombre || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <CatBadge cat={ing._catNorm} />
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {ing._producto || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p style={{
              fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px'
            }}>
              Riesgos principales:
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <RiskCard Icon={Skull} title="Mortal si se inhala" desc="o contacto con la piel prolongado" />
              <RiskCard Icon={Shield} title="EPP obligatorio" desc="guantes, gafas, traje y respirador" />
              <RiskCard Icon={Droplets} title="Riesgo hídrico" desc="contaminación de fuentes de agua" />
              <RiskCard Icon={Bug} title="Fauna benéfica" desc="peligro para abejas y organismos" />
              <RiskCard Icon={Ban} title="Fuera del alcance" desc="de niños y animales domésticos" />
            </div>
          </div>

          <div style={{
            padding: '12px 16px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.05)',
            border: '1.5px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <FileText size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
            <p style={{
              margin: 0, fontSize: '11.5px', fontWeight: '700', color: '#dc2626',
              textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1.4'
            }}>
              Estos productos deben estar respaldados por la prescripción de un ingeniero agrónomo
            </p>
          </div>

          <div style={{
            padding: '18px', borderRadius: '12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '4px'
            }}>
              <Lock size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{
                fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                Confirmación obligatoria
              </span>
            </div>

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              cursor: 'pointer', userSelect: 'none'
            }}>
              <div
                onClick={() => setCheck1(v => !v)}
                style={{
                  width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                  border: `2px solid ${check1 ? '#16a34a' : 'rgba(239,68,68,0.5)'}`,
                  background: check1 ? '#16a34a' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.18s', marginTop: '2px'
                }}
              >
                {check1 && <CheckCircle size={13} style={{ color: 'white' }} />}
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  Declaro que he leído, comprendido y acepto las advertencias de seguridad asociadas a estos ingredientes activos.
                </p>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  Como profesional responsable, asumo la obligación de cumplir la normativa vigente y garantizo
                  que el operario conoce las medidas de protección necesarias para la aplicación segura de estos productos.
                </p>
              </div>
            </label>

            <div style={{ borderTop: '1px solid var(--border-color)' }} />

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              cursor: 'pointer', userSelect: 'none'
            }}>
              <div
                onClick={() => setCheck2(v => !v)}
                style={{
                  width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                  border: `2px solid ${check2 ? '#16a34a' : 'rgba(239,68,68,0.5)'}`,
                  background: check2 ? '#16a34a' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.18s', marginTop: '2px'
                }}
              >
                {check2 && <CheckCircle size={13} style={{ color: 'white' }} />}
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '12px', fontWeight: '800', color: '#dc2626', lineHeight: '1.4', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Declaración del Profesional Responsable
                </p>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: '1.5', fontWeight: '500' }}>
                  Certifico que la selección de estos productos corresponde a un criterio técnico agronómico,
                  que he revisado sus riesgos toxicológicos y que las instrucciones de seguridad serán
                  comunicadas al operario responsable de la aplicación.
                </p>
              </div>
            </label>

            {geoStatus !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                fontSize: '11px', color: 'var(--text-muted)',
                padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.15)'
              }}>
                {geoStatus === 'loading'
                  ? <Loader2 size={12} style={{ animation: 'mat-spin 1s linear infinite', color: '#3b82f6' }} />
                  : <MapPin size={12} style={{ color: geoStatus === 'done' ? '#22c55e' : 'var(--text-muted)' }} />
                }
                {geoStatus === 'loading' && 'Obteniendo ubicación del dispositivo...'}
                {geoStatus === 'done'    && `Ubicación registrada (${geo?.lat?.toFixed(4)}, ${geo?.lng?.toFixed(4)})`}
                {geoStatus === 'denied'  && 'Permiso de ubicación denegado — se continuará sin coordenadas.'}
              </div>
            )}
          </div>

        </div>

        <div style={{
          padding: '16px 28px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: '12px', justifyContent: 'flex-end',
          borderRadius: '0 0 20px 20px',
          background: 'rgba(0,0,0,0.02)'
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '10px 22px', fontSize: '13.5px', fontFamily: 'inherit',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '9px', color: 'var(--text-secondary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              transition: 'all 0.15s', fontWeight: '600'
            }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={!canConfirm ? 'Debe confirmar ambas declaraciones para continuar.' : ''}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 24px', fontSize: '13.5px', fontFamily: 'inherit',
              fontWeight: '700', borderRadius: '9px', border: 'none',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              background: canConfirm ? '#16a34a' : 'rgba(107,114,128,0.15)',
              color: canConfirm ? 'white' : 'var(--text-muted)',
              boxShadow: canConfirm ? '0 4px 16px rgba(22,163,74,0.38)' : 'none',
              transition: 'all 0.22s'
            }}
            onMouseEnter={e => {
              if (canConfirm) {
                e.currentTarget.style.background = '#15803d';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(22,163,74,0.48)';
              }
            }}
            onMouseLeave={e => {
              if (canConfirm) {
                e.currentTarget.style.background = '#16a34a';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.38)';
              }
            }}
          >
            {isLoading
              ? <Loader2 size={15} style={{ animation: 'mat-spin 1s linear infinite' }} />
              : canConfirm
                ? <CheckCircle size={15} />
                : <Lock size={15} />
            }
            {isLoading ? 'Registrando...' : 'Generar Aplicación'}
          </button>
        </div>

        {!canConfirm && (
          <p style={{
            textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
            margin: '0 0 16px', paddingBottom: '4px'
          }}>
            🔒 Debe confirmar ambas declaraciones para habilitar esta acción.
          </p>
        )}

      </div>
    </div>
  );
}
export { normalizeCategory };
