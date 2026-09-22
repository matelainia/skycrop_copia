import { useState, useEffect, useMemo } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { isAuthenticated, subscribeAuthChange } from '../../lib/supabaseClient';
import {
  costsService,
  SOURCE_MODULES,
  EVENT_TYPES,
  EVENT_STATUSES
} from './services/costs.service';
import './costs-console.css';

const nowLocal = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

function ResultBox({ result, error }) {
  if (!result && !error) return null;
  if (error) {
    return (
      <div className="costv-alert costv-err">
        ✕ HTTP {error.status || '?'} · {error.code || 'ERROR'} — {error.message}
        {error.details ? <pre>{JSON.stringify(error.details, null, 2)}</pre> : null}
      </div>
    );
  }
  return (
    <div className="costv-alert costv-ok">
      ✓ OK<pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

function StatusBadge({ status }) {
  const pending = ['pending_price', 'pending_allocation'].includes(status);
  const bad = ['invalid', 'ignored'].includes(status);
  const done = ['posted', 'reversed'].includes(status);
  return (
    <span className={`costv-badge ${pending ? 'warn' : ''} ${bad ? 'bad' : ''} ${done ? 'ok' : ''}`}>
      {status}
    </span>
  );
}

function RegisterTab({ lotes, maquinarias, onDone }) {
  const [form, setForm] = useState({
    source_module: 'manual',
    source_entity: 'manual_console',
    source_id: crypto.randomUUID(),
    event_type: 'other_expense',
    occurred_at: nowLocal(),
    lote_id: '',
    maquinaria_id: '',
    quantity: '',
    source_unit: '',
    provided_amount: '100000',
    currency: 'COP',
    trap_company_id: ''
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const payload = {
        source_module: form.source_module,
        source_entity: form.source_entity.trim() || 'manual_console',
        source_id: form.source_id.trim(),
        event_type: form.event_type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        ...(form.lote_id ? { lote_id: form.lote_id } : {}),
        ...(form.maquinaria_id ? { maquinaria_id: form.maquinaria_id } : {}),
        ...(form.quantity !== '' ? { quantity: Number(form.quantity) } : {}),
        ...(form.source_unit ? { source_unit: form.source_unit } : {}),
        ...(form.provided_amount !== '' ? { provided_amount: Number(form.provided_amount) } : {}),
        currency: form.currency || 'COP',
        // Trampa de tenant: el backend debe ignorarlo (el tenant sale del JWT).
        ...(form.trap_company_id ? { company_id: form.trap_company_id } : {})
      };
      const data = await costsService.registerEvent(payload);
      setResult(data);
      onDone?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="costv-form" onSubmit={submit}>
      <h3>Registrar evento de costo</h3>
      <div className="costv-grid">
        <label>Módulo origen
          <select value={form.source_module} onChange={set('source_module')}>
            {SOURCE_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>Tipo de evento
          <select value={form.event_type} onChange={set('event_type')}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Entidad origen
          <input value={form.source_entity} onChange={set('source_entity')} maxLength={120} />
        </label>
        <label>Source ID (UUID)
          <div className="costv-row">
            <input value={form.source_id} onChange={set('source_id')} style={{ flex: 1 }} />
            <button type="button" onClick={() => setForm((f) => ({ ...f, source_id: crypto.randomUUID() }))}>Nuevo</button>
          </div>
        </label>
        <label>Ocurrencia
          <input type="datetime-local" value={form.occurred_at} onChange={set('occurred_at')} />
        </label>
        <label>Lote (dimensión)
          <select value={form.lote_id} onChange={set('lote_id')}>
            <option value="">— sin lote —</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo_interno || l.nombre} ({l.area_ha ?? '?'} ha)</option>)}
          </select>
        </label>
        <label>Maquinaria (dimensión)
          <select value={form.maquinaria_id} onChange={set('maquinaria_id')}>
            <option value="">— sin máquina —</option>
            {maquinarias.map((m) => <option key={m.id} value={m.id}>{m.codigo || m.nombre}</option>)}
          </select>
        </label>
        <label>Cantidad
          <input type="number" min="0" step="any" value={form.quantity} onChange={set('quantity')} placeholder="opcional" />
        </label>
        <label>Unidad
          <input value={form.source_unit} onChange={set('source_unit')} placeholder="kg, h, L…" maxLength={20} />
        </label>
        <label>Monto declarado (COP)
          <input type="number" min="0" step="any" value={form.provided_amount} onChange={set('provided_amount')} />
        </label>
        <label>Moneda
          <input value={form.currency} onChange={set('currency')} maxLength={3} />
        </label>
        <label className="costv-span">company_id trampa (el backend debe ignorarlo)
          <input value={form.trap_company_id} onChange={set('trap_company_id')} placeholder="UUID de otra empresa para probar" />
        </label>
      </div>
      <button type="submit" disabled={busy}>{busy ? 'Registrando…' : 'Registrar evento'}</button>
      <ResultBox result={result} error={error} />
    </form>
  );
}

function EventsTab({ refreshKey }) {
  const [filters, setFilters] = useState({ status: '', source_module: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const { data } = await costsService.listEvents({ ...filters, limit: 30 });
        if (!ctrl.signal.aborted) setRows(data);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [filters, refreshKey, tick]);

  const drive = async (id, stage) => {
    setResult(null);
    setError(null);
    try {
      const data = await costsService.driveEvent(id, stage);
      setResult(data);
      reload();
    } catch (e) {
      setError(e);
    }
  };

  const reverse = async (id) => {
    const reason = window.prompt('Motivo del reverso (mín. 5 caracteres):', 'Corrección prueba consola');
    if (!reason) return;
    setResult(null);
    setError(null);
    try {
      const data = await costsService.reverseEvent(id, reason);
      setResult(data);
      reload();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div>
      <h3>Eventos y ciclo de vida</h3>
      <div className="costv-row">
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">todos los estados</option>
          {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.source_module} onChange={(e) => setFilters((f) => ({ ...f, source_module: e.target.value }))}>
          <option value="">todos los módulos</option>
          {SOURCE_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={reload} disabled={loading}>{loading ? '…' : 'Recargar'}</button>
      </div>
      <ResultBox result={result} error={error} />
      <table className="costv-table">
        <thead><tr><th>Ocurrencia</th><th>Módulo / tipo</th><th>Estado</th><th>Monto base</th><th>Acciones</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="costv-mono">{String(r.occurred_at).slice(0, 16).replace('T', ' ')}</td>
              <td>{r.source_module}<br /><span className="costv-mut">{r.event_type}</span></td>
              <td><StatusBadge status={r.status} /></td>
              <td className="costv-num">{r.amount_base != null ? Number(r.amount_base).toLocaleString('es-CO') : '—'}</td>
              <td className="costv-actions">
                <button title="valorizar" onClick={() => drive(r.id, 'valorizar')}>V</button>
                <button title="asignar" onClick={() => drive(r.id, 'asignar')}>A</button>
                <button title="publicar" onClick={() => drive(r.id, 'publicar')}>P</button>
                <button title="reversar" onClick={() => reverse(r.id)}>R</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && <tr><td colSpan={5}>Sin eventos. Registra uno o finaliza una operación.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTab({ lotes }) {
  const [mode, setMode] = useState('lote');
  const [loteId, setLoteId] = useState('');
  const [laborId, setLaborId] = useState('');
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    setSummary(null);
    setEntries([]);
    try {
      const s = mode === 'lote'
        ? await costsService.loteSummary(loteId)
        : await costsService.laborSummary(laborId.trim());
      setSummary(s);
      const scope = mode === 'lote' ? { lote_id: loteId } : { labor_id: laborId.trim() };
      const { data } = await costsService.listEntries({ ...scope, limit: 50 });
      setEntries(data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CO'));

  return (
    <div>
      <h3>Resumen de costo</h3>
      <div className="costv-row">
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="lote">Por lote</option>
          <option value="labor">Por labor</option>
        </select>
        {mode === 'lote' ? (
          <select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
            <option value="">elige lote…</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo_interno || l.nombre}</option>)}
          </select>
        ) : (
          <input value={laborId} onChange={(e) => setLaborId(e.target.value)} placeholder="UUID de la labor" style={{ minWidth: 300 }} />
        )}
        <button onClick={load} disabled={busy || (mode === 'lote' ? !loteId : !laborId.trim())}>
          {busy ? '…' : 'Consultar'}
        </button>
      </div>
      {error && <div className="costv-alert costv-err">✕ HTTP {error.status || '?'} — {error.message}</div>}
      {summary && (
        <>
          <div className="costv-cards">
            <div className="costv-card"><span>Total</span><b>${fmt(summary.total)} {summary.moneda}</b></div>
            <div className="costv-card"><span>Directo / Indirecto</span><b>${fmt(summary.directo ?? summary.total)} / ${fmt(summary.indirecto ?? 0)}</b></div>
            <div className="costv-card"><span>Ingreso / Margen</span><b>${fmt(summary.ingreso)} / ${fmt(summary.margen_neto)}</b></div>
            <div className="costv-card"><span>Costo/ha</span><b>{summary.costo_ha != null ? `$${fmt(Math.round(summary.costo_ha))}` : 'sin área'}</b></div>
          </div>
          {summary.componentes?.length > 0 && (
            <table className="costv-table">
              <thead><tr><th>Componente</th><th>Monto</th></tr></thead>
              <tbody>
                {summary.componentes.map((c) => (
                  <tr key={c.cost_class}><td>{c.cost_class}</td><td className="costv-num">${fmt(c.monto)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <h4>Entradas (drill-down, con calidad de asignación)</h4>
          <table className="costv-table">
            <thead><tr><th>Fecha</th><th>Clase</th><th>Monto base</th><th>Directo</th><th>Calidad</th><th>Estado</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="costv-mono">{String(e.business_date).slice(0, 10)}</td>
                  <td>{e.cost_class}</td>
                  <td className="costv-num">${fmt(e.sign * e.amount_base)}</td>
                  <td>{e.directness}</td>
                  <td><span className="costv-badge">{e.allocation_quality || '—'}</span></td>
                  <td>{e.status}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={6}>Sin entradas publicadas en este alcance.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function IssuesTab({ refreshKey }) {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await costsService.listIssues({ status: status || undefined, limit: 50 });
        if (!ctrl.signal.aborted) setRows(data);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [status, refreshKey, tick]);

  return (
    <div>
      <h3>Issues — pendientes visibles (nunca $0 silencioso)</h3>
      <div className="costv-row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">abiertos</option>
          <option value="investigating">en investigación</option>
          <option value="resolved">resueltos</option>
          <option value="ignored">ignorados</option>
          <option value="">todos</option>
        </select>
        <button onClick={() => setTick((t) => t + 1)} disabled={loading}>{loading ? '…' : 'Recargar'}</button>
      </div>
      {error && <div className="costv-alert costv-err">✕ HTTP {error.status || '?'} — {error.message}</div>}
      <table className="costv-table">
        <thead><tr><th>Tipo</th><th>Severidad</th><th>Mensaje</th><th>Estado</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="costv-mono">{r.issue_type}</td>
              <td>{r.severity}</td>
              <td>{r.message}</td>
              <td>{r.status}</td>
            </tr>
          ))}
          {rows.length === 0 && !loading && <tr><td colSpan={4}>Sin issues. Todo valorizado y asignado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function CostsConsole() {
  const [tab, setTab] = useState('registrar');
  const [lotes, setLotes] = useState([]);
  const [maquinarias, setMaquinarias] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recalc, setRecalc] = useState(null);
  const [recalcErr, setRecalcErr] = useState(null);
  const [catalogErr, setCatalogErr] = useState(null);
  const { hasPermission, empresa } = useAuthContext();
  const canWrite = hasPermission ? hasPermission('costos', 'crear') : false;
  const [apiSession, setApiSession] = useState(() => isAuthenticated());

  useEffect(() => subscribeAuthChange(setApiSession), []);

  // Diagnóstico de tenant: org_id real dentro del JWT (lo que RLS usa).
  const jwtOrg = useMemo(() => {
    if (!apiSession) return null;
    try {
      const t = sessionStorage.getItem('sb_access_token');
      const payload = JSON.parse(
        atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      );
      return payload?.org_id || null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiSession, refreshKey]);

  useEffect(() => {
    if (!apiSession) return; // espera al token: sin sesión el proxy devuelve [] y no se reintenta
    let cancelled = false;
    (async () => {
      try {
        const [ls, ms] = await Promise.all([
          costsService.listLotes(),
          costsService.listMaquinarias()
        ]);
        if (!cancelled) {
          setLotes(ls);
          setMaquinarias(ms);
        }
      } catch (e) {
        if (!cancelled) {
          setCatalogErr(e);
          setLotes([]);
          setMaquinarias([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiSession]);

  const doRecalc = async () => {
    setRecalc(null);
    setRecalcErr(null);
    try {
      setRecalc(await costsService.recalculate({ mode: 'incremental' }));
    } catch (e) {
      setRecalcErr(e);
    }
  };

  return (
    <div className="costv-page">
      <header className="costv-head">
        <div>
          <h2>Costos de Producción <span className="costv-pill">validación · draft</span></h2>
          <p>Consola de prueba conjunta frontend + backend. Expone acciones a propósito para validar permisos y estados. Tu permiso <b>costos/crear</b>: {canWrite ? 'sí' : 'no (espera 403 al escribir)'}. Empresa app: <b>{empresa?.nombre || empresa?.id || '?'}</b> · JWT org: <b className="costv-mono">{jwtOrg ? `${jwtOrg.slice(0, 8)}…` : '—'}</b></p>
        </div>
        <button onClick={doRecalc} title="Stub seguro 066 §7: debe responder 501">Recalcular</button>
      </header>
      {(recalc || recalcErr) && <ResultBox result={recalc} error={recalcErr} />}
      {catalogErr && (
        <div className="costv-alert costv-err">
          ✕ No cargaron lotes/maquinaria: {catalogErr.message || catalogErr}
          <br />Abre DevTools → Network, busca la petición <b>lotes?select=</b> y dime su HTTP + respuesta.
        </div>
      )}
      {!apiSession && (
        <div className="costv-alert costv-err">
          ✕ Sin sesión API (sb_access_token ausente): el backend responderá 403 aunque veas permisos locales.
          Cierra sesión y vuelve a entrar. Si persiste, abre DevTools → Console y busca el error de <b>/auth/me</b> en <b>[DEBUG FRONTEND]</b> (el backend dev debe estar corriendo en :3000).
        </div>
      )}
      <nav className="costv-tabs">
        {[
          ['registrar', 'Registrar'],
          ['eventos', 'Eventos y ciclo'],
          ['resumen', 'Resúmenes'],
          ['issues', 'Issues']
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {tab === 'registrar' && <RegisterTab lotes={lotes} maquinarias={maquinarias} onDone={() => setRefreshKey((k) => k + 1)} />}
      {tab === 'eventos' && <EventsTab refreshKey={refreshKey} />}
      {tab === 'resumen' && <SummaryTab lotes={lotes} />}
      {tab === 'issues' && <IssuesTab refreshKey={refreshKey} />}
    </div>
  );
}

export default CostsConsole;
