import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@shared/types'

export function useSettings(): {
  settings: AppSettings | undefined
  isLoading: boolean
  updateSetting: (vars: { key: keyof AppSettings; value: AppSettings[keyof AppSettings] }) => void
} {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => window.api.settings.load(),
    staleTime: Infinity
  })

  const { mutate: updateSetting } = useMutation({
    mutationFn: ({
      key,
      value
    }: {
      key: keyof AppSettings
      value: AppSettings[keyof AppSettings]
    }) => window.api.settings.update(key, value as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  })

  return { settings, isLoading, updateSetting }
}
