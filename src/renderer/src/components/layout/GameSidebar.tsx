import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@renderer/hooks/use-game'
import { PersonalityMatcher } from '@components/advisor'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@components/ui/sheet'

interface GameSidebarProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GameSidebar({ isOpen, onOpenChange }: GameSidebarProps): React.JSX.Element {
  const navigate = useNavigate()
  const { currentGame, savedGames, switchGame, removeGame, updateGamePersonality } = useGame()
  const [localOpen, setLocalOpen] = useState(false)
  const [advisorOpen, setAdvisorOpen] = useState(false)

  const open = isOpen !== undefined ? isOpen : localOpen
  const setOpen = onOpenChange || setLocalOpen

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="cic-btn fixed top-1 left-3 z-50" style={{ padding: '3px 10px' }}>
            ☰ Fleet Command
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 overflow-y-auto p-0 border-0"
          style={{
            background: 'linear-gradient(180deg, var(--cic-panel) 0%, var(--cic-void) 100%)',
            borderRight: '1px solid var(--cic-panel-edge)'
          }}
        >
          <SheetHeader
            className="p-4 pb-3"
            style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
          >
            <SheetTitle
              className="cic-label"
              style={{ color: 'var(--cic-amber)', fontSize: '11px', letterSpacing: '0.2em' }}
            >
              Fleet Command
            </SheetTitle>
          </SheetHeader>

          <div className="p-3 space-y-2">
            <button
              className="cic-btn cic-btn-amber w-full"
              onClick={() => {
                navigate('/')
                setOpen(false)
              }}
            >
              + New Campaign
            </button>

            <button
              className="cic-btn w-full"
              onClick={() => {
                navigate('/settings')
                setOpen(false)
              }}
            >
              Config
            </button>

            {savedGames.length === 0 ? (
              <div
                className="cic-data text-center py-6"
                style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}
              >
                No campaigns detected.
                <br />
                Initialize a new campaign to begin.
              </div>
            ) : (
              <div className="space-y-1 mt-3">
                <div className="cic-label px-1 pb-1">Campaigns ({savedGames.length})</div>
                {savedGames
                  .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
                  .map((game) => {
                    const isActive = currentGame?.id === game.id
                    return (
                      <div
                        key={game.id}
                        className="cic-panel cursor-pointer group"
                        style={{
                          borderColor: isActive ? 'var(--cic-cyan)' : undefined,
                          boxShadow: isActive ? '0 0 8px var(--cic-cyan-glow)' : undefined
                        }}
                        onClick={() => {
                          switchGame(game.id)
                          navigate('/dashboard')
                          setOpen(false)
                        }}
                      >
                        <div className="p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="cic-data truncate"
                              style={{
                                color: isActive ? 'var(--cic-cyan)' : 'rgba(255,255,255,0.7)',
                                fontSize: '11px'
                              }}
                            >
                              {game.gameInfo.gameName}
                            </span>
                            {isActive && (
                              <span
                                className="cic-label"
                                style={{ color: 'var(--cic-green)', fontSize: '8px' }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div
                              className="cic-data"
                              style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px' }}
                            >
                              {game.gameInfo.empireName} — {game.gameInfo.techLevel}
                            </div>
                            <div
                              className="cic-data"
                              style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}
                            >
                              Year {game.gameInfo.startingYear} — {formatDate(game.lastAccessedAt)}
                            </div>
                            {game.personalityName ? (
                              <button
                                className="cic-data block text-left"
                                style={{
                                  color: 'var(--cic-amber-dim)',
                                  fontSize: '9px',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isActive) {
                                    setOpen(false)
                                    // Small delay so sidebar closes first
                                    setTimeout(() => setAdvisorOpen(true), 200)
                                  }
                                }}
                                title={isActive ? 'Click to change advisor' : undefined}
                              >
                                Advisor: {game.personalityName} {isActive ? '✎' : ''}
                              </button>
                            ) : isActive ? (
                              <button
                                className="cic-data block text-left"
                                style={{
                                  color: 'var(--cic-amber-dim)',
                                  fontSize: '9px',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpen(false)
                                  setTimeout(() => setAdvisorOpen(true), 200)
                                }}
                              >
                                + Assign advisor
                              </button>
                            ) : null}
                          </div>
                          <div className="flex justify-end mt-1">
                            <button
                              className="cic-data"
                              style={{
                                color: 'rgba(255,255,255,0.2)',
                                fontSize: '8px',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--cic-red)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(255,255,255,0.2)'
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`Decommission "${game.gameInfo.gameName}"?`)) {
                                  removeGame(game.id)
                                }
                              }}
                            >
                              Decommission
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Advisor personality matcher — separate sheet, not nested */}
      <Sheet open={advisorOpen} onOpenChange={setAdvisorOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-4xl overflow-y-auto border-0"
          style={{
            background: 'linear-gradient(180deg, var(--cic-panel) 0%, var(--cic-void) 100%)',
            borderLeft: '1px solid var(--cic-panel-edge)'
          }}
        >
          <SheetHeader className="pb-3" style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}>
            <SheetTitle
              className="cic-label"
              style={{ color: 'var(--cic-amber)', fontSize: '11px', letterSpacing: '0.2em' }}
            >
              {currentGame?.personalityName ? 'Change Advisor' : 'Select Advisor'}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PersonalityMatcher
              onComplete={(archetype, personalityName) => {
                updateGamePersonality(archetype, personalityName)
                toast.success('Advisor updated', {
                  description: `${personalityName} is now your advisor`
                })
                setAdvisorOpen(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
