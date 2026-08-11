/**
 * mockDashboard.js
 * Single source of data for the Fertilización dashboard (Estado inicial limpio por usuario).
 */

export const mockDashboardData = {
  metrics: [
    {
      id: 'active-plans',
      icon: 'Sprout',
      value: 0,
      unit: '',
      label: 'Planes Activos',
      note: 'Sin planes activos',
      noteColor: 'info',
    },
    {
      id: 'recommendations',
      icon: 'Flask',
      value: 0,
      unit: '',
      label: 'Recomendaciones',
      note: 'Este mes',
      noteColor: 'info',
    },
    {
      id: 'nutrients-applied',
      icon: 'Droplets',
      value: 0,
      unit: 'kg',
      label: 'Nutrientes Aplicados',
      note: 'Este mes',
      noteColor: 'info',
    },
    {
      id: 'compliance',
      icon: 'TrendingUp',
      value: 0,
      unit: '%',
      label: 'Cumplimiento de Planes',
      note: 'Promedio general',
      noteColor: 'warning',
    },
  ],

  plans: [],
  recommendations: [],
  soilAnalysis: [],
};
