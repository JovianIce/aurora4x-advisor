import React, { useState, useMemo, useRef, useEffect } from 'react'

export interface PickerItem {
  id: string | number
  label: string
  group?: string
  sub?: string
}

interface SearchPickerProps {
  items: PickerItem[]
  value: string | number | null
  onSelect: (id: string | number) => void
  placeholder?: string
  title?: string
  /** Render the trigger button - receives display label and open handler */
  children?: (props: { label: string; open: () => void }) => React.JSX.Element
}

export function SearchPicker({
  items,
  value,
  onSelect,
  placeholder = 'Select...',
  title = 'Select',
  children
}: SearchPickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedItem = items.find((i) => i.id === value)
  const displayLabel = selectedItem?.label || placeholder

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      // Focus search input on next frame
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!search) return items
    const lower = search.toLowerCase()
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(lower) ||
        (i.sub && i.sub.toLowerCase().includes(lower)) ||
        (i.group && i.group.toLowerCase().includes(lower))
    )
  }, [items, search])

  // Group items
  const grouped = useMemo(() => {
    const groups = new Map<string, PickerItem[]>()
    for (const item of filtered) {
      const g = item.group || ''
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)!.push(item)
    }
    return groups
  }, [filtered])

  const handleSelect = (id: string | number): void => {
    onSelect(id)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') setIsOpen(false)
  }

  // Default trigger: styled like a select
  const trigger = children ? (
    children({ label: displayLabel, open: () => setIsOpen(true) })
  ) : (
    <button
      onClick={() => setIsOpen(true)}
      className="cursor-pointer text-left w-full"
      style={{
        fontSize: 11,
        padding: '4px 8px',
        background: 'var(--cic-panel)',
        border: '1px solid var(--cic-panel-edge)',
        borderRadius: 4,
        color: value ? 'var(--foreground)' : 'var(--cic-cyan-dim)'
      }}
    >
      {displayLabel}
    </button>
  )

  return (
    <>
      {trigger}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--cic-deep)',
              border: '1px solid var(--cic-panel-edge)',
              borderRadius: 8,
              width: 420,
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between shrink-0"
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--cic-panel-edge)'
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cic-cyan)' }}>
                {title}
              </span>
              <span style={{ fontSize: 9, color: 'var(--cic-cyan-dim)' }}>
                {filtered.length} of {items.length}
              </span>
            </div>

            {/* Search */}
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--cic-panel-edge)' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="focus:outline-none w-full"
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  background: 'var(--cic-panel)',
                  border: '1px solid var(--cic-panel-edge)',
                  borderRadius: 4,
                  color: 'var(--cic-cyan)'
                }}
              />
            </div>

            {/* Items */}
            <div className="flex-1 overflow-auto" style={{ padding: '4px 0' }}>
              {[...grouped.entries()].map(([groupName, groupItems]) => (
                <div key={groupName}>
                  {groupName && (
                    <div
                      style={{
                        fontSize: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--cic-cyan-dim)',
                        padding: '6px 12px 2px',
                        fontWeight: 600
                      }}
                    >
                      {groupName}
                    </div>
                  )}
                  {groupItems.map((item) => {
                    const isSelected = item.id === value
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        className="cursor-pointer"
                        style={{
                          padding: '3px 12px',
                          fontSize: 10,
                          background: isSelected ? 'rgba(0,229,255,0.1)' : undefined,
                          color: isSelected ? 'var(--cic-cyan)' : 'var(--foreground)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.background =
                              'rgba(0,229,255,0.05)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.background = ''
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                            {item.label}
                          </span>
                          {item.sub && (
                            <span style={{ fontSize: 9, color: 'var(--cic-cyan-dim)' }}>
                              {item.sub}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div
                  style={{
                    padding: 12,
                    fontSize: 10,
                    color: 'var(--cic-cyan-dim)',
                    textAlign: 'center'
                  }}
                >
                  No matches
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex justify-end shrink-0"
              style={{
                padding: '6px 12px',
                borderTop: '1px solid var(--cic-panel-edge)'
              }}
            >
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer"
                style={{
                  fontSize: 10,
                  padding: '3px 10px',
                  border: '1px solid var(--cic-panel-edge)',
                  borderRadius: 4,
                  background: 'var(--cic-panel)',
                  color: 'var(--cic-cyan-dim)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
