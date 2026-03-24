import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@shared/types'

export function useSettings() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => window.api.settings.load(),
    staleTime: Infinity
  })

  const { mutate: updateSetting } = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      window.api.settings.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  })

  return { settings, isLoading, updateSetting }
}
