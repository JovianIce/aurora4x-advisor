import { THEMES, type ThemeId } from '@renderer/contexts/theme-context'
import { useTheme } from '@renderer/hooks/use-theme'
import { Button } from '@components/ui/button'
import { cn } from '@renderer/lib/utils'

export function ThemeSelector(): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {THEMES.map((t) => {
        const isActive = theme === t.id
        return (
          <Button
            key={t.id}
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1.5 px-2.5 font-mono text-[10px] uppercase tracking-wider',
              isActive && 'border border-ring bg-accent text-accent-foreground'
            )}
            onClick={() => setTheme(t.id as ThemeId)}
            title={t.description}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                background: t.swatch,
                boxShadow: isActive ? `0 0 6px ${t.swatch}` : 'none'
              }}
            />
            {t.label}
          </Button>
        )
      })}
    </div>
  )
}
