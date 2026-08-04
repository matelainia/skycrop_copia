/**
 * useFertilizationDashboard.js
 * Single React Query hook for the entire Fertilización dashboard.
 *
 * Returns: { metrics, plans, recommendations, soilAnalysis, loading, error, refetch }
 *
 * Cache strategy:
 *   staleTime: 5 min  — data considered fresh, no background refetch
 *   gcTime:    10 min — cached in memory after component unmounts
 *
 * When switching to Supabase, only fertilization.api.js changes.
 * This hook remains untouched.
 */

import { useQuery } from '@tanstack/react-query';
import { fertilizationService } from '../services/fertilization.service.js';

export const FERTILIZATION_QUERY_KEY = ['fertilization', 'dashboard'];

export function useFertilizationDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: FERTILIZATION_QUERY_KEY,
    queryFn: () => fertilizationService.getDashboard(),
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 10 * 60 * 1000,     // 10 minutes
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  return {
    metrics:         data?.metrics         ?? [],
    plans:           data?.plans           ?? [],
    recommendations: data?.recommendations ?? [],
    soilAnalysis:    data?.soilAnalysis    ?? [],
    loading: isLoading,
    error: error ?? null,
    refetch,
  };
}
