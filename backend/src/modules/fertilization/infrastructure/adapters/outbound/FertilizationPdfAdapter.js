/**
 * FertilizationPdfAdapter.js
 * Adaptador de salida: generación de PDF del plan de fertilización.
 *
 * Estrategia: Genera HTML estructurado y lo devuelve listo para imprimir.
 * El cliente puede usar window.print() o el backend puede usar
 * puppeteer-core si se instala en el futuro.
 *
 * Por ahora retorna el HTML como Buffer (Content-Type: text/html)
 * con estilos de impresión (@media print) incluidos.
 * El endpoint también puede devolver el mismo HTML con header
 * Content-Disposition: attachment para que el navegador lo descargue.
 */

export class FertilizationPdfAdapter {
  /**
   * Genera el documento del plan de fertilización.
   * @param {Object} detail - Detalle completo del plan (normalizado)
   * @returns {Promise<{ buffer: Buffer, contentType: string, filename: string }>}
   */
  async generatePlanPdf(detail) {
    const plan = detail.plan || {};
    const items = detail.items || [];
    const apps = detail.applications || [];
    const obs = detail.observations || [];
    const alerts = detail.alerts || [];
    const nutri = detail.nutrition || [];

    const html = this._buildHtml({ plan, items, apps, obs, alerts, nutri });
    const buffer = Buffer.from(html, 'utf-8');

    return {
      buffer,
      contentType: 'text/html; charset=utf-8',
      filename: `plan-fertilizacion-${plan.code || plan.id || 'export'}.html`
    };
  }

  /** @private */
  _buildHtml({ plan, items, apps, obs, alerts, nutri }) {
    const formatDate = (d) => {
      if (!d) return '—';
      return new Date(d).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    const formatCurrency = (n) => {
      if (!n && n !== 0) return '—';
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: plan.currency || 'COP',
        maximumFractionDigits: 0
      }).format(n);
    };

    const statusLabel = {
      draft: 'Borrador',
      active: 'En ejecución',
      paused: 'Pausado',
      completed: 'Completado',
      archived: 'Archivado'
    };
    const obsTypeLabel = {
      note: 'Nota',
      symptom: 'Síntoma',
      foliar_analysis: 'Análisis Foliar',
      application: 'Aplicación',
      soil: 'Suelo',
      climate: 'Clima'
    };
    const sevLabel = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Plan de Fertilización — ${plan.name || ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; line-height: 1.5; }
    h1 { font-size: 20px; font-weight: 700; color: #15803d; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 600; color: #166534; border-bottom: 2px solid #bbf7d0; padding-bottom: 6px; margin: 24px 0 12px; }
    h3 { font-size: 12px; font-weight: 600; color: #374151; margin: 16px 0 8px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #15803d; padding-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 600; background: #dcfce7; color: #166534; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; margin-bottom: 16px; }
    .field { display: flex; flex-direction: column; }
    .field-label { font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .field-value { font-size: 12px; color: #111827; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f0fdf4; color: #166534; font-weight: 600; padding: 6px 10px; text-align: left; border: 1px solid #d1fae5; font-size: 10px; }
    td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-value { font-size: 20px; font-weight: 700; color: #15803d; }
    .kpi-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    .obs-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .obs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .obs-type { font-size: 10px; font-weight: 600; color: #6b7280; }
    .obs-content { color: #374151; line-height: 1.6; }
    .alert-row { background: #fff7ed; border-left: 3px solid #f97316; padding: 8px 12px; margin-bottom: 6px; border-radius: 0 6px 6px 0; }
    .alert-sev { font-size: 10px; font-weight: 700; color: #c2410c; }
    .nutri-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
    .nutri-bar { height: 6px; border-radius: 3px; background: #d1fae5; flex: 1; margin: 0 12px; }
    .nutri-fill { height: 100%; border-radius: 3px; }
    .fill-low { background: #f97316; }
    .fill-optimal { background: #22c55e; }
    .fill-high { background: #3b82f6; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
      h2 { page-break-before: auto; }
      .obs-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:10px;color:#6b7280;margin-bottom:4px;">SKYCROP — PLAN DE FERTILIZACIÓN</div>
      <h1>${plan.name || 'Sin nombre'}</h1>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;">${plan.code || ''} ${plan.version ? `· ${plan.version}` : ''}</div>
    </div>
    <div style="text-align:right;">
      <span class="badge">${statusLabel[plan.status] || plan.status || 'Borrador'}</span>
      <div style="font-size:10px;color:#6b7280;margin-top:6px;">Generado: ${formatDate(new Date())}</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-value">${plan.applicationsCompleted || 0}/${plan.applicationsTotal || 0}</div>
      <div class="kpi-label">Aplicaciones</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${plan.progressPct || 0}%</div>
      <div class="kpi-label">Avance</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${plan.observationsTotal || 0}</div>
      <div class="kpi-label">Observaciones</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatCurrency(plan.budgetExecuted)}</div>
      <div class="kpi-label">Inversión Ejecutada</div>
    </div>
  </div>

  <!-- Información General -->
  <h2>Información General</h2>
  <div class="grid-3">
    <div class="field"><span class="field-label">Predio / Lote</span><span class="field-value">${plan.lot_name || '—'}</span></div>
    <div class="field"><span class="field-label">Sector</span><span class="field-value">${plan.sector_name || '—'}</span></div>
    <div class="field"><span class="field-label">Área</span><span class="field-value">${plan.area_ha ? `${plan.area_ha} ha` : '—'}</span></div>
    <div class="field"><span class="field-label">Cultivo</span><span class="field-value">${plan.crop_name || '—'}</span></div>
    <div class="field"><span class="field-label">Etapa Fenológica</span><span class="field-value">${plan.phenological_stage || '—'}</span></div>
    <div class="field"><span class="field-label">Suelo</span><span class="field-value">${plan.soil_type || '—'}</span></div>
    <div class="field"><span class="field-label">Responsable</span><span class="field-value">${plan.responsible_name || '—'}</span></div>
    <div class="field"><span class="field-label">Período</span><span class="field-value">${plan.period_label || `${formatDate(plan.start_date)} — ${formatDate(plan.end_date)}`}</span></div>
    <div class="field"><span class="field-label">Presupuesto Total</span><span class="field-value">${formatCurrency(plan.budget_total)}</span></div>
  </div>

  <!-- Insumos -->
  ${
    items.length > 0
      ? `
  <h2>Detalle del Plan de Fertilización</h2>
  <table>
    <thead><tr><th>Producto / Fórmula</th><th>Tipo</th><th>Dosis</th><th>Método</th><th>Aplicaciones</th></tr></thead>
    <tbody>
      ${items
        .map(
          (i) => `
        <tr>
          <td><strong>${i.product_name}</strong>${i.product_formula ? `<br><small style="color:#6b7280">${i.product_formula}</small>` : ''}</td>
          <td>${i.item_type || '—'}</td>
          <td>${i.dose_value ? `${i.dose_value} ${i.dose_unit || ''}` : '—'}</td>
          <td>${i.application_method || '—'}</td>
          <td>${i.applications_done || 0}/${i.applications_planned || 0}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <!-- Cronograma -->
  ${
    apps.length > 0
      ? `
  <h2>Cronograma de Aplicaciones</h2>
  <table>
    <thead><tr><th>#</th><th>Producto</th><th>Fecha Programada</th><th>Fecha Realizada</th><th>Estado</th></tr></thead>
    <tbody>
      ${apps
        .map(
          (a) => `
        <tr>
          <td>${a.application_number || '—'}</td>
          <td>${a.product_name || '—'}</td>
          <td>${formatDate(a.scheduled_date)}</td>
          <td>${a.completed_date ? formatDate(a.completed_date) : '—'}</td>
          <td>${a.status === 'completed' ? '✓ Realizada' : a.status === 'pending' ? 'Pendiente' : a.status}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <!-- Estado Nutricional -->
  ${
    nutri.length > 0
      ? `
  <h2>Estado Nutricional</h2>
  <div style="margin-bottom:16px;">
    ${nutri
      .map(
        (n) => `
      <div class="nutri-row">
        <span style="width:80px;font-weight:600;">${n.element_name || n.element_code}</span>
        <span style="font-size:11px;color:#6b7280;">${n.value}${n.unit || '%'}</span>
        <div class="nutri-bar"><div class="nutri-fill fill-${n.status || 'optimal'}" style="width:${Math.min(100, (n.value / (n.target_max || n.value || 1)) * 100)}%"></div></div>
        <span style="font-size:10px;font-weight:600;color:${n.status === 'low' ? '#f97316' : n.status === 'high' ? '#3b82f6' : '#22c55e'};">${n.status === 'low' ? 'Bajo' : n.status === 'high' ? 'Alto' : 'Óptimo'}</span>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <!-- Alertas -->
  ${
    alerts.length > 0
      ? `
  <h2>Alertas Activas</h2>
  ${alerts
    .map(
      (al) => `
    <div class="alert-row">
      <div class="alert-sev">${sevLabel[al.severity] || al.severity} — ${al.title}</div>
      <div style="font-size:11px;color:#374151;margin-top:4px;">${al.description || ''}</div>
    </div>
  `
    )
    .join('')}
  `
      : ''
  }

  <!-- Observaciones -->
  ${
    obs.length > 0
      ? `
  <h2>Observaciones de Campo</h2>
  ${obs
    .map(
      (o) => `
    <div class="obs-card">
      <div class="obs-header">
        <span class="obs-type">${obsTypeLabel[o.observation_type] || o.observation_type}</span>
        <span style="font-size:10px;color:#6b7280;">${formatDate(o.observed_at)} · ${o.author_name || 'Sistema'}</span>
      </div>
      ${o.title ? `<div style="font-weight:600;margin-bottom:4px;">${o.title}</div>` : ''}
      <div class="obs-content">${o.content}</div>
      ${o.is_alert ? `<div style="margin-top:6px;font-size:10px;color:#f97316;font-weight:600;">⚠ Marcada como alerta (${o.severity || 'sin severidad'})</div>` : ''}
      ${
        (o.nutrients || []).length > 0
          ? `
        <div style="margin-top:8px;font-size:10px;color:#6b7280;">
          Nutrientes: ${o.nutrients.map((n) => `${n.element_code}: ${n.value}${n.unit || '%'}`).join(' · ')}
        </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('')}
  `
      : ''
  }

  <div class="footer">
    <span>SkyCrop — Sistema de Gestión Agrícola</span>
    <span>Plan generado el ${new Date().toLocaleString('es-CO')}</span>
  </div>
</body>
</html>`;
  }
}
