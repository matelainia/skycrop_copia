/**
 * useFertilizationRecommendation.js
 * Estado del Paso 3: Recomendación — separa userInput de calculatedValues (§21).
 *
 * - El usuario edita: producto, presentación, nutrientes %, doseMode + doseValue
 * - El sistema deriva: kg/ha, kg/planta, g/planta, bultos, aporte, cobertura
 * - La lógica matemática NO vive en componentes; se importa de calculations/.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  createEmptyFertilizerRow,
  ALL_KNOWN_NUTRIENTS,
  PRIMARY_NUTRIENTS,
} from '../types/recommendation.types.js';
import { validateComposition } from '../calculations/nutrientCalculations.js';
import { calculateRecommendationReport } from '../calculations/contributionCalculations.js';

function toNutrientComposition(row) {
  const comp = {};
  // estándar
  for (const code of ALL_KNOWN_NUTRIENTS) {
    const raw = row.nutrients?.[code];
    const n = Number(raw);
    if (raw !== '' && raw !== null && raw !== undefined && Number.isFinite(n) && n > 0) {
      comp[code] = n;
    }
  }
  // customNutrients adicionales (§5 agregar elemento)
  for (const c of row.customNutrients || []) {
    const n = Number(c.value);
    if (c.code && Number.isFinite(n) && n > 0) comp[c.code] = n;
  }
  return comp;
}

function validateRow(row) {
  const errs = {};
  if (!row.productName?.trim()) errs.productName = 'Selecciona un producto';
  if (row.presentationKg !== 'custom' && (Number(row.presentationKg) <= 0 || !Number.isFinite(Number(row.presentationKg)))) {
    errs.presentationKg = 'Presentación inválida';
  }
  if (row.presentationKg === 'custom') {
    const cv = Number(row.presentationCustom);
    if (!Number.isFinite(cv) || cv <= 0) errs.presentationKg = 'Ingresa kg personalizados';
  }
  // composición
  const comp = toNutrientComposition(row);
  if (Object.keys(comp).length === 0) errs.composition = 'Registra al menos un nutriente > 0';
  else {
    const msg = validateComposition(comp);
    if (msg) errs.composition = msg;
  }
  // dosis
  const dv = Number(row.doseValue);
  if (row.doseValue === '' || !Number.isFinite(dv) || dv <= 0) errs.doseValue = 'Dosis > 0 requerida';
  return Object.keys(errs).length ? errs : null;
}

export function useFertilizationRecommendation({
  initialRows = null,
  areaHa = null,
  globalPlantsPerHa = null,
  requirements = null, // Record<code, kg/ha>
} = {}) {
  const [rows, setRows] = useState(() => initialRows || [createEmptyFertilizerRow()]);
  const [activeCustomInput, setActiveCustomInput] = useState(null); // rowId or null

  // ─── Mutaciones ─────────────────────────────────────────────────────────

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyFertilizerRow()]);
  }, []);

  const removeRow = useCallback((id) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  const updateRow = useCallback((id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const updateNutrient = useCallback((id, code, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, nutrients: { ...r.nutrients, [code]: value } } : r)),
    );
  }, []);

  const addCustomNutrient = useCallback((id, code, name) => {
    if (!code) return;
    const trimmed = code.trim();
    if (!trimmed) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const exists = (r.customNutrients || []).some((c) => c.code === trimmed) || r.enabledNutrients.includes(trimmed);
        if (exists) return r;
        return {
          ...r,
          enabledNutrients: [...r.enabledNutrients, trimmed],
          customNutrients: [...(r.customNutrients || []), { code: trimmed, name: name || trimmed, value: '' }],
        };
      }),
    );
  }, []);

  const updateCustomNutrient = useCallback((id, code, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        // si es nutriente estándar, va a nutrients; si custom, a customNutrients
        if (ALL_KNOWN_NUTRIENTS.includes(code)) {
          return { ...r, nutrients: { ...r.nutrients, [code]: value } };
        }
        return {
          ...r,
          customNutrients: (r.customNutrients || []).map((c) => (c.code === code ? { ...c, value } : c)),
        };
      }),
    );
  }, []);

  const removeCustomNutrient = useCallback((id, code) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        // no permitir quitar primarios
        if (PRIMARY_NUTRIENTS.includes(code)) return r;
        return {
          ...r,
          enabledNutrients: r.enabledNutrients.filter((c) => c !== code),
          customNutrients: (r.customNutrients || []).filter((c) => c.code !== code),
          nutrients: Object.fromEntries(Object.entries(r.nutrients).filter(([k]) => k !== code)),
        };
      }),
    );
  }, []);

  const setRowFromCatalog = useCallback((id, fert) => {
    // fert: { id, commercial_name/commercialName, composition:{} }
    if (!fert) return;
    const comp = fert.composition || fert.composicion || {};
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const nextNutrients = { ...r.nutrients };
        const enabled = new Set(r.enabledNutrients);
        for (const [code, pct] of Object.entries(comp)) {
          if (pct === null || pct === undefined) continue;
          nextNutrients[code] = String(pct);
          enabled.add(code);
          // si es código no estándar, registrar como custom
          if (!ALL_KNOWN_NUTRIENTS.includes(code)) {
            // asegurar customNutrients
          }
        }
        // registrar custom nutrients no estándar
        const customExtra = Object.entries(comp)
          .filter(([code]) => !ALL_KNOWN_NUTRIENTS.includes(code))
          .map(([code, val]) => ({ code, name: code, value: String(val) }));
        const mergedCustom = [...(r.customNutrients || [])];
        for (const c of customExtra) {
          if (!mergedCustom.some((x) => x.code === c.code)) mergedCustom.push(c);
        }
        return {
          ...r,
          productId: fert.product_id ?? fert.productId ?? null,
          fertilizerId: fert.id ?? null,
          productName: fert.commercial_name || fert.commercialName || fert.name || r.productName,
          nutrients: nextNutrients,
          enabledNutrients: [...enabled],
          customNutrients: mergedCustom,
        };
      }),
    );
  }, []);

  // ─── Validación ─────────────────────────────────────────────────────────

  const rowErrors = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const e = validateRow(r);
      if (e) map[r.id] = e;
    }
    return map;
  }, [rows]);

  const isValid = useMemo(() => Object.keys(rowErrors).length === 0, [rowErrors]);

  // ─── Cálculos derivados (solo si el área / plantas lo permiten) ───────

  const presentationFor = useCallback(
    (row) => {
      if (row.presentationKg === 'custom') return Number(row.presentationCustom);
      return Number(row.presentationKg);
    },
    [],
  );

  const report = useMemo(() => {
    // requiere al menos 1 fila válida para reportar; si no, igual retorna estructura vacía
    const fertilizers = rows.map((r) => ({
      id: r.id,
      name: r.productName || '—',
      presentationKg: presentationFor(r),
      doseMode: r.doseMode || 'kg_ha',
      doseValue: Number(r.doseValue),
      composition: toNutrientComposition(r),
    }));

    const pHa = globalPlantsPerHa !== null && globalPlantsPerHa !== '' ? Number(globalPlantsPerHa) : null;
    // plantas por ha también puede venir por fila; usamos global si no hay por fila
    // aquí priorizamos global; si el caller necesita por-fila, que lo resuelva antes
    return calculateRecommendationReport({
      fertilizers,
      plantsPerHa: pHa,
      areaHa: areaHa !== null && areaHa !== '' ? Number(areaHa) : null,
      requirements: requirements || {},
    });
  }, [rows, globalPlantsPerHa, areaHa, requirements, presentationFor]);

  return {
    rows,
    setRows,
    rowErrors,
    isValid,
    addRow,
    removeRow,
    updateRow,
    updateNutrient,
    addCustomNutrient,
    updateCustomNutrient,
    removeCustomNutrient,
    setRowFromCatalog,
    activeCustomInput,
    setActiveCustomInput,
    report,
    // raw helpers
    presentationFor,
  };
}
