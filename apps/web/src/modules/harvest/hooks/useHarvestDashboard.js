import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { harvestService } from '../services/harvestService';

export function useHarvestDashboard(filters) {
  return useQuery({
    queryKey: ['harvest-dashboard', filters],
    queryFn: () => harvestService.getDashboard(filters),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useHarvestList(filters) {
  return useQuery({
    queryKey: ['harvest-list', filters],
    queryFn: () => harvestService.listHarvests(filters),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

export function useCreateHarvest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => harvestService.createHarvest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['harvest-dashboard'] });
      qc.invalidateQueries({ queryKey: ['harvest-list'] });
    },
  });
}
