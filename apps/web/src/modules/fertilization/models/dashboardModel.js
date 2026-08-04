/**
 * dashboardModel.js
 * Transforms raw API/RPC data into the UI-ready dashboard shape.
 *
 * Today: identity transform (mock already matches UI shape).
 * Future: maps Supabase snake_case → camelCase, computes derived fields,
 *         normalizes date formats, etc.
 */

import { transformPlan } from './planModel.js';

/**
 * @param {object} raw - Raw response from getDashboard() / rpc_fertilization_dashboard()
 * @returns {object} UI-ready dashboard data
 */
export function transformDashboard(raw) {
  if (!raw) return null;

  return {
    metrics: Array.isArray(raw.metrics) ? raw.metrics : [],
    plans: Array.isArray(raw.plans) ? raw.plans.map(transformPlan) : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    soilAnalysis: Array.isArray(raw.soilAnalysis) ? raw.soilAnalysis : [],
  };
}
