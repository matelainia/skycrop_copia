/**
 * fertilization.api.js
 * Raw data access layer for the Fertilización module.
 *
 * Today: returns mock data with a simulated network delay.
 * Future: calls supabase.rpc('rpc_fertilization_dashboard', { empresa_id })
 *
 * This is the ONLY file that needs to change when switching to Supabase.
 * No changes required in services, hooks, or components.
 */

import { mockDashboardData } from '../data/mockDashboard.js';

// ─── Mock implementation (active) ────────────────────────────────────────────

/**
 * Returns the complete dashboard data object.
 * Shape: { metrics, plans, recommendations, soilAnalysis }
 *
 * @returns {Promise<object>}
 */
export async function getDashboard() {
  // Simulate network latency (remove when switching to Supabase)
  await new Promise((resolve) => setTimeout(resolve, 400));
  return structuredClone(mockDashboardData);
}

// ─── Supabase implementation (future — uncomment and replace above) ──────────
//
// import { supabase } from '@/lib/supabaseClient';
//
// export async function getDashboard() {
//   const { data, error } = await supabase
//     .rpc('rpc_fertilization_dashboard', {
//       p_empresa_id: getCurrentEmpresaId(), // inject from auth context
//     });
//
//   if (error) throw new Error(error.message);
//   return data; // RPC returns the same { metrics, plans, recommendations, soilAnalysis } shape
// }
