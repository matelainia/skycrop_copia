/**
 * mockPlanDetail.js
 * Datos mock realistas para la pantalla de detalle del plan de fertilización.
 * Refleja exactamente la forma del shape normalizado del backend.
 * Se usa mientras USE_MOCK = true en plan-detail.api.js.
 */

export const mockPlanDetail = {
  plan: {
    id:                   'pf-2024-0001',
    company_id:           'company-abc',
    lote_id:              'lote-12',
    code:                 'PF-2024-0001',
    name:                 'Plan Cacao – Fertilización Q3 2024',
    version:              'v2.0',
    status:               'active',
    validity_status:      'in_progress',
    start_date:           '2024-07-01',
    end_date:             '2024-09-30',
    period_label:         'Q3 2024 · jul – sept',
    crop_name:            'Cacao',
    crop_scientific:      'Theobroma cacao',
    lot_name:             'Lote 12 – El Paraíso',
    sector_name:          'Sector Norte',
    farm_name:            'Finca El Paraíso',
    area_ha:              4.5,
    soil_type:            'Franco-arcilloso · pH obj. 6.4',
    density:              '1,100 árboles/ha',
    phenological_stage:   'Llenado',
    responsible_name:     'Sebastián Díaz',
    responsible_user_id:  'user-sd-01',
    budget_total:         6100000,
    budget_executed:      4200000,
    currency:             'COP',
    // Métricas (normalizadas por el use case)
    progressPct:          68,
    applicationsTotal:    8,
    applicationsCompleted: 5,
    observationsTotal:    5,
    attachmentsTotal:     3,
    alertsActive:         2,
    notes:                'Plan aprobado por dirección agronómica. Revisión quincenal.',
    created_at:           '2024-07-01T08:00:00Z',
    updated_at:           '2024-08-04T07:45:00Z',
  },

  items: [
    {
      id: 'item-01', product_name: 'KCl #2', product_formula: 'KCl 60%',
      item_type: 'Fertilizante potásico', dose_value: 150, dose_unit: 'kg/ha',
      application_method: 'Edáfica', applications_planned: 4, applications_done: 2,
      sort_order: 1,
    },
    {
      id: 'item-02', product_name: 'Urea', product_formula: 'N 46%',
      item_type: 'Fertilizante nitrogenado', dose_value: 100, dose_unit: 'kg/ha',
      application_method: 'Edáfica', applications_planned: 3, applications_done: 2,
      sort_order: 2,
    },
    {
      id: 'item-03', product_name: 'DAP', product_formula: 'N 18% P 46%',
      item_type: 'Fertilizante fosfórico', dose_value: 80, dose_unit: 'kg/ha',
      application_method: 'Edáfica', applications_planned: 2, applications_done: 1,
      sort_order: 3,
    },
    {
      id: 'item-04', product_name: 'Boro líquido', product_formula: 'B 10%',
      item_type: 'Micronutriente', dose_value: 1.5, dose_unit: 'L/ha',
      application_method: 'Foliar', applications_planned: 3, applications_done: 2,
      sort_order: 4,
    },
    {
      id: 'item-05', product_name: 'Cal dolomita', product_formula: 'CaCO3·MgCO3',
      item_type: 'Enmienda', dose_value: 500, dose_unit: 'kg/ha',
      application_method: 'Edáfica', applications_planned: 1, applications_done: 0,
      sort_order: 5,
    },
  ],

  applications: [
    { id: 'app-01', application_number: 1, product_name: 'KCl #2', scheduled_date: '2024-07-05', completed_date: '2024-07-05', status: 'completed', dose_applied: 150, dose_unit: 'kg/ha' },
    { id: 'app-02', application_number: 2, product_name: 'Urea + DAP', scheduled_date: '2024-07-15', completed_date: '2024-07-16', status: 'completed', dose_applied: 100, dose_unit: 'kg/ha' },
    { id: 'app-03', application_number: 3, product_name: 'Boro foliar', scheduled_date: '2024-07-25', completed_date: '2024-07-25', status: 'completed', dose_applied: 1.5, dose_unit: 'L/ha' },
    { id: 'app-04', application_number: 4, product_name: 'KCl #2', scheduled_date: '2024-08-05', completed_date: '2024-08-05', status: 'completed', dose_applied: 150, dose_unit: 'kg/ha' },
    { id: 'app-05', application_number: 5, product_name: 'Urea + Boro', scheduled_date: '2024-08-15', completed_date: '2024-08-15', status: 'completed', dose_applied: 100, dose_unit: 'kg/ha' },
    { id: 'app-06', application_number: 6, product_name: 'KCl #2', scheduled_date: '2024-08-26', completed_date: null, status: 'pending', completion_note: null },
    { id: 'app-07', application_number: 7, product_name: 'DAP + Cal', scheduled_date: '2024-09-10', completed_date: null, status: 'pending', completion_note: null },
    { id: 'app-08', application_number: 8, product_name: 'Boro foliar final', scheduled_date: '2024-09-25', completed_date: null, status: 'pending', completion_note: null },
  ],

  nextApp: {
    id: 'app-06', application_number: 6, product_name: 'KCl #2',
    scheduled_date: '2024-08-26', status: 'pending',
  },

  observations: [
    {
      id: 'obs-01',
      observation_type: 'foliar_analysis',
      title: 'Análisis Foliar — Laboratorio Agronómico Cali',
      content: 'Resultados del análisis foliar del 12 de agosto. Potasio en nivel bajo (1.6%), requiere ajuste en próxima aplicación. Calcio y Magnesio en rango óptimo.',
      author_name: 'Sebastián Díaz',
      is_alert: false,
      severity: null,
      observed_at: '2024-08-12T10:30:00Z',
      sector: 'Sector Norte — Bloque A',
      comments: [
        { id: 'c-01', author_name: 'Ingeniero Agr.', content: 'Se confirma ajuste en dosis KCl para app-06.', created_at: '2024-08-12T14:00:00Z' }
      ],
      attachments: [
        { id: 'att-01', file_name: 'analisis_foliar_ago2024.pdf', mime_type: 'application/pdf', size_bytes: 524288 }
      ],
      nutrients: [
        { element_code: 'N',  element_name: 'Nitrógeno', value: 2.4,  unit: '%', status: 'optimal', target_min: 2.0, target_max: 3.0 },
        { element_code: 'P',  element_name: 'Fósforo',   value: 0.19, unit: '%', status: 'optimal', target_min: 0.15, target_max: 0.3 },
        { element_code: 'K',  element_name: 'Potasio',   value: 1.6,  unit: '%', status: 'low',     target_min: 2.0, target_max: 3.5 },
        { element_code: 'Ca', element_name: 'Calcio',    value: 1.9,  unit: '%', status: 'optimal', target_min: 1.5, target_max: 2.5 },
        { element_code: 'Mg', element_name: 'Magnesio',  value: 0.42, unit: '%', status: 'optimal', target_min: 0.3, target_max: 0.6 },
      ],
    },
    {
      id: 'obs-02',
      observation_type: 'symptom',
      title: 'Deficiencia visual de Potasio',
      content: 'Se observa clorosis marginal en hojas maduras en aproximadamente 15% de los árboles del bloque B. Síntoma típico de deficiencia de K. Se generó alerta para seguimiento.',
      author_name: 'Carlos Mejía',
      is_alert: true,
      severity: 'medium',
      affected_percent: 15,
      observed_at: '2024-08-10T08:15:00Z',
      sector: 'Sector Norte — Bloque B',
      comments: [],
      attachments: [
        { id: 'att-02', file_name: 'sintoma_clorosis.jpg', mime_type: 'image/jpeg', size_bytes: 1048576 }
      ],
      nutrients: [],
    },
    {
      id: 'obs-03',
      observation_type: 'application',
      title: null,
      content: 'Aplicación 5 completada con éxito. Condiciones climáticas favorables, sin lluvia en las próximas 6 horas. Equipo de 4 operarios. Dosificación correcta verificada.',
      author_name: 'Sebastián Díaz',
      is_alert: false,
      severity: null,
      observed_at: '2024-08-15T07:00:00Z',
      sector: null,
      comments: [],
      attachments: [],
      nutrients: [],
    },
    {
      id: 'obs-04',
      observation_type: 'climate',
      title: 'Condiciones climáticas — semana del 5 ago',
      content: 'Semana con alta precipitación (45mm). Suelo saturado. Se recomienda posponer aplicación edáfica programada y evaluar condiciones el lunes siguiente.',
      author_name: 'Sistema de Monitoreo',
      is_alert: true,
      severity: 'low',
      observed_at: '2024-08-05T06:00:00Z',
      sector: null,
      comments: [
        { id: 'c-02', author_name: 'Sebastián Díaz', content: 'Confirmado. App-06 reprogramada para el 26 ago.', created_at: '2024-08-05T09:00:00Z' }
      ],
      attachments: [],
      nutrients: [],
    },
    {
      id: 'obs-05',
      observation_type: 'note',
      title: 'Revisión quincenal del plan',
      content: 'Plan ejecutado al 68% según cronograma. Las 3 aplicaciones pendientes se concentran en agosto-septiembre. Se confirma presupuesto disponible para las mismas.',
      author_name: 'Sebastián Díaz',
      is_alert: false,
      severity: null,
      observed_at: '2024-08-04T07:45:00Z',
      sector: null,
      comments: [],
      attachments: [],
      nutrients: [],
    },
  ],

  alerts: [
    {
      id: 'alert-01',
      title: 'Deficiencia de K · pH bajo',
      description: 'Clorosis marginal detectada en ~15% de árboles. Potasio foliar en 1.6%, por debajo del umbral óptimo de 2.0%.',
      severity: 'medium',
      is_resolved: false,
      created_at: '2024-08-10T08:15:00Z',
    },
    {
      id: 'alert-02',
      title: 'Suelo saturado · Riesgo de lixiviación',
      description: 'Precipitación acumulada de 45mm en la semana. Riesgo de pérdida de nutrientes por lixiviación antes de la próxima aplicación.',
      severity: 'low',
      is_resolved: false,
      created_at: '2024-08-05T06:00:00Z',
    },
  ],

  fieldCondition: {
    recorded_at:       '2024-08-04T06:00:00Z',
    temperature_c:     27,
    humidity_pct:      74,
    wind_speed_kmh:    12,
    wind_direction:    'NE',
    precipitation_mm:  0,
    soil_moisture_pct: 42,
    soil_ph:           6.2,
    location_label:    'Valle del Cauca, CO',
    source:            'weather_api',
  },

  nutrition: [
    { element_code: 'N',  element_name: 'Nitrógeno', value: 2.4,  unit: '%', status: 'optimal', target_min: 2.0, target_max: 3.0 },
    { element_code: 'P',  element_name: 'Fósforo',   value: 0.19, unit: '%', status: 'optimal', target_min: 0.15, target_max: 0.3 },
    { element_code: 'K',  element_name: 'Potasio',   value: 1.6,  unit: '%', status: 'low',     target_min: 2.0, target_max: 3.5 },
    { element_code: 'Ca', element_name: 'Calcio',    value: 1.9,  unit: '%', status: 'optimal', target_min: 1.5, target_max: 2.5 },
    { element_code: 'Mg', element_name: 'Magnesio',  value: 0.42, unit: '%', status: 'optimal', target_min: 0.3, target_max: 0.6 },
  ],
};
