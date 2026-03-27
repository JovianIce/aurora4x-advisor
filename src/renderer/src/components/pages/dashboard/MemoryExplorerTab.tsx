import React, { useState } from 'react'
import { useAuroraData } from '../../../contexts/aurora-data-context'
import { useQuery } from '@tanstack/react-query'

interface CollectionEntry {
  field: string
  collectionType: 'Dict' | 'List'
  keyType: string | null
  itemType: string
  count: number
  fieldCount: number
  schema: { name: string; type: string }[]
}

export function MemoryExplorerTab(): React.JSX.Element {
  const { isConnected } = useAuroraData()
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'collections' | 'allFields'>('collections')
  const [previewLimit, setPreviewLimit] = useState(20)
  const [includeRefs, setIncludeRefs] = useState(false)
  const [filterField, setFilterField] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [dumping, setDumping] = useState(false)
  const [dumpResult, setDumpResult] = useState<string | null>(null)

  // Enumerate all collections
  const {
    data: collections,
    isLoading: collectionsLoading,
    refetch: refetchCollections
  } = useQuery<CollectionEntry[]>({
    queryKey: ['memoryCollections'],
    queryFn: () => window.api.bridge.enumerateCollections() as Promise<CollectionEntry[]>,
    enabled: isConnected
  })

  // Enumerate all GameState fields
  const { data: allFields, isLoading: fieldsLoading } = useQuery<
    { name: string; type: string; value?: unknown; count?: number; itemFields?: number }[]
  >({
    queryKey: ['gameStateFields'],
    queryFn: () => window.api.bridge.enumerateGameState(),
    enabled: isConnected && viewMode === 'allFields'
  })

  // Get selected collection info
  const selectedInfo = collections?.find((c) => c.field === selectedCollection)

  // Read items from selected collection
  const {
    data: items,
    isLoading: itemsLoading,
    refetch: refetchItems
  } = useQuery<Record<string, unknown>[]>({
    queryKey: [
      'memoryItems',
      selectedCollection,
      previewLimit,
      includeRefs,
      filterField,
      filterValue
    ],
    queryFn: () =>
      window.api.bridge.readCollection({
        Field: selectedCollection!,
        Limit: previewLimit,
        IncludeRefs: includeRefs,
        FilterField: filterField || undefined,
        FilterValue: filterValue || undefined
      }),
    enabled: isConnected && !!selectedCollection
  })

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="cic-data" style={{ color: 'var(--cic-cyan-dim)' }}>
          Bridge offline. Start Aurora with AuroraPatch to explore memory.
        </span>
      </div>
    )
  }

  const sorted = [...(collections || [])].sort((a, b) => b.count - a.count)
  const nonEmpty = sorted.filter((c) => c.count > 0)
  const empty = sorted.filter((c) => c.count === 0)

  return (
    <div className="flex gap-3 h-[calc(100vh-100px)] min-h-[400px]">
      {/* Left: Collection List */}
      <div
        className="flex-shrink-0 overflow-hidden flex flex-col"
        style={{
          width: '240px',
          background: 'linear-gradient(180deg, var(--cic-panel) 0%, var(--cic-deep) 100%)',
          border: '1px solid var(--cic-panel-edge)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-2 py-1.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
        >
          <div className="flex items-center gap-2">
            <button
              className={`cic-btn ${viewMode === 'collections' ? 'active' : ''}`}
              onClick={() => setViewMode('collections')}
              style={{ fontSize: '9px', padding: '2px 6px' }}
            >
              Collections
            </button>
            <button
              className={`cic-btn ${viewMode === 'allFields' ? 'active' : ''}`}
              onClick={() => setViewMode('allFields')}
              style={{ fontSize: '9px', padding: '2px 6px' }}
            >
              All Fields
            </button>
          </div>
          <button
            className="cic-btn"
            onClick={() => refetchCollections()}
            style={{ fontSize: '9px', padding: '2px 6px' }}
            title="Refresh"
          >
            {collectionsLoading ? '...' : 'R'}
          </button>
          <button
            className="cic-btn cic-btn-amber"
            disabled={dumping}
            onClick={async () => {
              setDumping(true)
              setDumpResult(null)
              try {
                const result = await window.api.bridge.dumpMemory()
                if (result) {
                  setDumpResult(
                    `${result.files.length} files, ${result.totalItems} items → ${result.outputDir}`
                  )
                } else {
                  setDumpResult('Cancelled')
                }
              } catch (err) {
                setDumpResult(`Error: ${err}`)
              } finally {
                setDumping(false)
              }
            }}
            style={{ fontSize: '9px', padding: '2px 6px' }}
            title="Dump all collections to JSON files"
          >
            {dumping ? '...' : 'DUMP'}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'collections' ? (
            <>
              {nonEmpty.length > 0 && (
                <div className="p-1">
                  <div className="cic-label px-2 py-1" style={{ color: 'var(--cic-cyan-dim)' }}>
                    With Data ({nonEmpty.length})
                  </div>
                  {nonEmpty.map((c) => (
                    <button
                      key={c.field}
                      onClick={() => setSelectedCollection(c.field)}
                      className="w-full text-left px-2 py-1 flex items-center justify-between"
                      style={{
                        background:
                          selectedCollection === c.field ? 'var(--cic-cyan-glow)' : 'transparent',
                        borderLeft:
                          selectedCollection === c.field
                            ? '2px solid var(--cic-cyan)'
                            : '2px solid transparent'
                      }}
                    >
                      <div>
                        <span
                          className="cic-data"
                          style={{
                            color:
                              selectedCollection === c.field
                                ? 'var(--cic-cyan)'
                                : 'rgba(255,255,255,0.6)',
                            fontSize: '11px'
                          }}
                        >
                          {c.field}
                        </span>
                        <span
                          className="cic-label ml-1"
                          style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px' }}
                        >
                          {c.itemType}
                        </span>
                      </div>
                      <span
                        className="cic-data"
                        style={{ color: 'var(--cic-amber-dim)', fontSize: '10px' }}
                      >
                        {c.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {empty.length > 0 && (
                <div className="p-1">
                  <div className="cic-label px-2 py-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Empty ({empty.length})
                  </div>
                  {empty.map((c) => (
                    <button
                      key={c.field}
                      onClick={() => setSelectedCollection(c.field)}
                      className="w-full text-left px-2 py-1"
                      style={{
                        background:
                          selectedCollection === c.field ? 'var(--cic-cyan-glow)' : 'transparent',
                        borderLeft:
                          selectedCollection === c.field
                            ? '2px solid var(--cic-cyan)'
                            : '2px solid transparent'
                      }}
                    >
                      <span
                        className="cic-data"
                        style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}
                      >
                        {c.field}
                      </span>
                      <span
                        className="cic-label ml-1"
                        style={{ color: 'rgba(255,255,255,0.15)', fontSize: '8px' }}
                      >
                        {c.itemType}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {collectionsLoading && (
                <div className="p-4 text-center">
                  <span className="cic-label" style={{ color: 'var(--cic-amber)' }}>
                    SCANNING...
                  </span>
                </div>
              )}
            </>
          ) : (
            /* All Fields view */
            <div className="p-1">
              {fieldsLoading ? (
                <div className="p-4 text-center">
                  <span className="cic-label" style={{ color: 'var(--cic-amber)' }}>
                    SCANNING GAMESTATE...
                  </span>
                </div>
              ) : (
                allFields?.map((f) => (
                  <div
                    key={f.name}
                    className="px-2 py-0.5 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <div>
                      <span
                        className="cic-data"
                        style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}
                      >
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="cic-label"
                        style={{ fontSize: '8px', color: typeColor(f.type) }}
                      >
                        {f.type}
                      </span>
                      {f.count != null && (
                        <span
                          className="cic-data"
                          style={{ fontSize: '9px', color: 'var(--cic-amber-dim)' }}
                        >
                          {f.count}
                        </span>
                      )}
                      {f.value != null && typeof f.value !== 'object' && (
                        <span
                          className="cic-data"
                          style={{
                            fontSize: '9px',
                            color: 'var(--cic-cyan-dim)',
                            maxWidth: '60px'
                          }}
                          title={String(f.value)}
                        >
                          {truncate(String(f.value), 10)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dump status */}
        {dumpResult && (
          <div
            className="px-2 py-1.5 flex-shrink-0"
            style={{ borderTop: '1px solid var(--cic-panel-edge)' }}
          >
            <span
              className="cic-data"
              style={{ fontSize: '8px', color: 'var(--cic-amber-dim)', wordBreak: 'break-all' }}
            >
              {dumpResult}
            </span>
          </div>
        )}
      </div>

      {/* Right: Content */}
      <div
        className="flex-1 overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(180deg, var(--cic-panel) 0%, var(--cic-deep) 100%)',
          border: '1px solid var(--cic-panel-edge)'
        }}
      >
        {!selectedCollection ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="cic-label" style={{ fontSize: '12px', marginBottom: '8px' }}>
                Select a collection
              </div>
              <div className="cic-data" style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}>
                Browse GameState memory objects from the list
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
            >
              <div className="flex items-center gap-3">
                <span className="cic-data" style={{ color: 'var(--cic-cyan)', fontSize: '13px' }}>
                  {selectedCollection}
                </span>
                {selectedInfo && (
                  <>
                    <span className="cic-label" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {selectedInfo.collectionType}&lt;{selectedInfo.itemType}&gt;
                    </span>
                    <span
                      className="cic-data"
                      style={{ color: 'var(--cic-amber)', fontSize: '11px' }}
                    >
                      {selectedInfo.count.toLocaleString()} items
                    </span>
                    <span className="cic-label" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {selectedInfo.fieldCount} fields
                    </span>
                  </>
                )}
              </div>
              <button
                className="cic-btn"
                onClick={() => refetchItems()}
                style={{ fontSize: '10px' }}
              >
                Refresh
              </button>
            </div>

            {/* Schema */}
            {selectedInfo && (
              <div
                className="px-3 py-1.5 flex flex-wrap gap-1 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
              >
                {selectedInfo.schema.map((s) => (
                  <span
                    key={s.name}
                    className="cic-data"
                    style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                      color: typeColor(s.type)
                    }}
                    title={`${s.name}: ${s.type}`}
                  >
                    {s.name}
                    <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: '3px' }}>
                      {s.type}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Controls */}
            <div
              className="px-3 py-1.5 flex items-center gap-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
            >
              <div className="flex items-center gap-1">
                <span className="cic-label">Limit:</span>
                <select
                  value={previewLimit}
                  onChange={(e) => setPreviewLimit(Number(e.target.value))}
                  className="cic-data"
                  style={{
                    background: 'var(--cic-deep)',
                    border: '1px solid var(--cic-panel-edge)',
                    color: 'var(--cic-cyan-dim)',
                    fontSize: '10px',
                    padding: '1px 4px'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
              </div>

              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRefs}
                  onChange={(e) => setIncludeRefs(e.target.checked)}
                  style={{ accentColor: 'var(--cic-cyan)' }}
                />
                <span className="cic-label">Sub-objects</span>
              </label>

              <div className="flex items-center gap-1">
                <span className="cic-label">Filter:</span>
                <input
                  type="text"
                  placeholder="field"
                  value={filterField}
                  onChange={(e) => setFilterField(e.target.value)}
                  className="cic-data"
                  style={{
                    background: 'var(--cic-deep)',
                    border: '1px solid var(--cic-panel-edge)',
                    color: 'var(--cic-cyan-dim)',
                    fontSize: '10px',
                    padding: '1px 4px',
                    width: '60px'
                  }}
                />
                <span className="cic-label">=</span>
                <input
                  type="text"
                  placeholder="value"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="cic-data"
                  style={{
                    background: 'var(--cic-deep)',
                    border: '1px solid var(--cic-panel-edge)',
                    color: 'var(--cic-cyan-dim)',
                    fontSize: '10px',
                    padding: '1px 4px',
                    width: '80px'
                  }}
                />
              </div>
            </div>

            {/* Data */}
            <div className="flex-1 overflow-auto">
              {itemsLoading ? (
                <div className="p-4 text-center">
                  <span className="cic-label" style={{ color: 'var(--cic-amber)' }}>
                    READING MEMORY...
                  </span>
                </div>
              ) : items && items.length > 0 ? (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {Object.keys(items[0])
                        .filter((k) => k !== '_index')
                        .map((col) => (
                          <th
                            key={col}
                            className="cic-label text-left whitespace-nowrap sticky top-0"
                            style={{
                              padding: '4px 8px',
                              background: 'var(--cic-panel)',
                              borderBottom: '1px solid var(--cic-panel-edge)',
                              fontSize: '9px',
                              color: 'var(--cic-cyan-dim)'
                            }}
                          >
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                        }}
                      >
                        {Object.entries(row)
                          .filter(([k]) => k !== '_index')
                          .map(([key, val]) => (
                            <td
                              key={key}
                              className="cic-data whitespace-nowrap"
                              style={{
                                padding: '3px 8px',
                                fontSize: '10px',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color:
                                  val === null
                                    ? 'rgba(255,255,255,0.15)'
                                    : typeof val === 'object'
                                      ? 'var(--cic-amber-dim)'
                                      : typeof val === 'string'
                                        ? 'var(--cic-green)'
                                        : typeof val === 'boolean'
                                          ? val
                                            ? 'var(--cic-green)'
                                            : 'var(--cic-red)'
                                          : 'rgba(255,255,255,0.6)'
                              }}
                              title={
                                val === null
                                  ? 'null'
                                  : typeof val === 'object'
                                    ? JSON.stringify(val)
                                    : String(val)
                              }
                            >
                              {val === null
                                ? '—'
                                : typeof val === 'object'
                                  ? `{${Object.keys(val as Record<string, unknown>).length} fields}`
                                  : typeof val === 'boolean'
                                    ? val
                                      ? 'true'
                                      : 'false'
                                    : String(val)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-center">
                  <span
                    className="cic-data"
                    style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}
                  >
                    {items?.length === 0
                      ? 'No items match filter'
                      : 'Select a collection to view items'}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function typeColor(type: string): string {
  if (type === 'int' || type === 'Int32' || type === 'long' || type === 'Int64')
    return 'var(--cic-cyan-dim)'
  if (
    type === 'double' ||
    type === 'float' ||
    type === 'decimal' ||
    type === 'Double' ||
    type === 'Single'
  )
    return '#7986cb'
  if (type === 'string' || type === 'String') return 'var(--cic-green)'
  if (type === 'bool' || type === 'Boolean') return 'var(--cic-amber)'
  if (type === 'enum') return '#ce93d8'
  if (type.startsWith('ref:')) return 'var(--cic-amber-dim)'
  if (type.startsWith('Dict') || type.startsWith('List')) return 'var(--cic-cyan)'
  return 'rgba(255,255,255,0.4)'
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.substring(0, n) + '...'
}
