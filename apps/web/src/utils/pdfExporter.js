import { formatCOP } from './format.js';

/**
 * Escapa entidades HTML para prevenir XSS al renderizar datos del plan
 * (nombres de productos, responsables, etc. provienen de base de datos).
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Exportador de PDF Client-side para Ficha de Plan de Fertilización SkyCrop
 * Genera un documento con branding visual de SkyCrop, tablas e información nutricional.
 */
export async function exportFertilizationPlanPDF(plan) {
  // Sanitización XSS: se escapan todos los datos dinámicos antes de interpolar
  const safe = JSON.parse(JSON.stringify(plan), (key, value) =>
    typeof value === 'string' ? escapeHtml(value) : value
  );

  // Crear una ventana o elemento de impresión formateado con HTML/CSS de la marca SkyCrop
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor habilita las ventanas emergentes (popups) para descargar el PDF.');
    return;
  }

  const itemsHtml = (safe.applications || [])
    .map(
      (item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${item.productName || item.productId}</strong></td>
      <td>${item.dose} kg/ha</td>
      <td>${item.date}</td>
      <td>${item.method === 'foliar' ? 'Foliar' : 'Al suelo'}</td>
      <td>${formatCOP(item.cost || 0)}</td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${safe.code || 'Plan'} - Ficha Técnica SkyCrop</title>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #2b2b2b; margin: 0; padding: 20px; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #16a34a; padding-bottom: 15px; margin-bottom: 20px; }
        .brand { color: #16a34a; font-size: 24px; font-weight: bold; }
        .code-badge { background: #e2f4e4; color: #15803d; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: bold; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f5f1e8; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
        .grid-item { font-size: 12px; }
        .grid-item label { color: #6b7280; font-weight: bold; display: block; margin-bottom: 2px; }
        .grid-item span { color: #111; font-size: 14px; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th { background: #f5f1e8; color: #15803d; text-align: left; padding: 10px; border-bottom: 2px solid #ebe7db; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        .total-box { margin-top: 20px; text-align: right; font-size: 16px; font-weight: bold; color: #16a34a; }
        .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">🌿 SkyCrop · Manejo de Nutrición</div>
        <div class="code-badge">${safe.code || 'PF-2024-001'}</div>
      </div>

      <h2>${safe.name || 'Plan de Fertilización'}</h2>

      <div class="grid">
        <div class="grid-item"><label>CULTIVO</label><span>${safe.crop_name || safe.cropName || 'Cacao'}</span></div>
        <div class="grid-item"><label>ETAPA</label><span>${safe.phenological_stage || safe.stage || 'Llenado'}</span></div>
        <div class="grid-item"><label>LOTE / ÁREA</label><span>${safe.lot_name || safe.lotName || 'Lote 12'} (${safe.area_ha || safe.area || 4.5} ha)</span></div>
        <div class="grid-item"><label>RESPONSABLE</label><span>${safe.responsible_name || safe.responsibleName || 'Sebastián Díaz'}</span></div>
        <div class="grid-item"><label>SUELO</label><span>${safe.soil_type || safe.soilType || 'Franco-arcilloso'}</span></div>
        <div class="grid-item"><label>FECHAS</label><span>${safe.start_date || safe.startDate} - ${safe.end_date || safe.endDate}</span></div>
      </div>

      <h3>Cronograma de Aplicaciones</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Producto</th>
            <th>Dosis</th>
            <th>Fecha Programada</th>
            <th>Método</th>
            <th>Costo Est.</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="6">Sin aplicaciones registradas.</td></tr>'}
        </tbody>
      </table>

      <div class="total-box">
        Presupuesto Total Estimado: ${formatCOP(safe.budget_total || safe.totalBudget || 0)}
      </div>

      <div class="footer">
        Documento generado automáticamente por el sistema SkyCrop · Documento de Control de Nutrición Vegetal
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
