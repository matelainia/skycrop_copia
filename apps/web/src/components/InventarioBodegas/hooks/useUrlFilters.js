import { useState, useCallback } from 'react';

// Filtros persistidos en URL (?q=&cat=&wh=&st=&sort=&dir=&page=&tab=).
// Trazabilidad y enlaces compartidos dentro de la org (contrato §5).
// Sin react-router en el proyecto: se usa history.replaceState.
const DEFAULTS = { q: '', cat: 'Todos', wh: 'all', st: 'todos', sort: 'name', dir: '1', page: '1', tab: 'insumos' };
const VALID_TABS = ['insumos', 'bodegas', 'movs'];

function readParams() {
  const sp = new URLSearchParams(window.location.search || '');
  const get = (k) => {
    const v = sp.get(k);
    return v === null || v === '' ? DEFAULTS[k] : v;
  };
  const tab = get('tab');
  return {
    q: get('q'), cat: get('cat'), wh: get('wh'), st: get('st'),
    sort: get('sort'), dir: get('dir') === '-1' ? '-1' : '1',
    page: /^\d+$/.test(get('page')) ? get('page') : '1',
    tab: VALID_TABS.includes(tab) ? tab : 'insumos',
  };
}

function writeParams(p) {
  const sp = new URLSearchParams();
  for (const k of Object.keys(DEFAULTS)) {
    if (p[k] !== DEFAULTS[k]) sp.set(k, p[k]);
  }
  const qs = sp.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  window.history.replaceState(null, '', url);
}

export function useUrlFilters() {
  const [params, setParams] = useState(readParams);

  const update = useCallback((patch) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      // Cualquier cambio de filtro vuelve a la página 1 (salvo page/tab).
      if (!('page' in patch) && !('tab' in patch)) next.page = '1';
      writeParams(next);
      return next;
    });
  }, []);

  return [params, update];
}
