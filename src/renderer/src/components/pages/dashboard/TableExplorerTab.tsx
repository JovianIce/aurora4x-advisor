import React, { useState } from 'react'
import { useAuroraData } from '../../../contexts/aurora-data-context'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@components/ui/button'

export function TableExplorerTab(): React.JSX.Element {
  const { tables, tablesLoading, isConnected, refetchTables } = useAuroraData()
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [previewLimit] = useState(20)

  // Preview rows from selected table
  const { data: previewRows, isLoading: previewLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['tablePreview', selectedTable, previewLimit],
    queryFn: async () => {
      const rows = await window.api.bridge.query(`SELECT * FROM "${selectedTable}" LIMIT ${previewLimit}`)
      return rows as Record<string, unknown>[]
    },
    enabled: isConnected && !!selectedTable
  })

  // Table schema
  const { data: tableSchema } = useQuery<{ name: string; type: string }[]>({
    queryKey: ['tableSchema', selectedTable],
    queryFn: () =>
      window.api.bridge.getTableInfo(selectedTable!) as Promise<{ name: string; type: string }[]>,
    enabled: isConnected && !!selectedTable
  })

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Bridge not connected. Start Aurora with AuroraPatch.
      </div>
    )
  }

  const nonEmptyTables = tables.filter((t) => t.rows > 0)
  const emptyTables = tables.filter((t) => t.rows === 0)

  return (
    <div className="flex gap-4 h-[calc(100vh-380px)] min-h-[400px]">
      {/* Table list */}
      <div className="w-64 flex-shrink-0 overflow-y-auto border rounded-lg p-2 space-y-1">
        <div className="flex items-center justify-between pb-2 border-b mb-2">
          <span className="text-sm font-medium">Tables ({tables.length})</span>
          <Button variant="ghost" size="sm" onClick={() => refetchTables()}>
            {tablesLoading ? '...' : 'Refresh'}
          </Button>
        </div>

        {nonEmptyTables.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground px-2 pt-1">
              With Data ({nonEmptyTables.length})
            </div>
            {nonEmptyTables
              .sort((a, b) => b.rows - a.rows)
              .map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedTable(t.name)}
                  className={`w-full text-left px-2 py-1 rounded text-sm flex justify-between items-center hover:bg-accent ${
                    selectedTable === t.name ? 'bg-accent' : ''
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                    {t.rows.toLocaleString()}
                  </span>
                </button>
              ))}
          </>
        )}

        {emptyTables.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground px-2 pt-3">
              Empty ({emptyTables.length})
            </div>
            {emptyTables.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTable(t.name)}
                className={`w-full text-left px-2 py-1 rounded text-sm text-muted-foreground hover:bg-accent ${
                  selectedTable === t.name ? 'bg-accent' : ''
                }`}
              >
                {t.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Table content */}
      <div className="flex-1 overflow-auto border rounded-lg">
        {!selectedTable ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a table to view its contents
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">{selectedTable}</h3>
              <span className="text-sm text-muted-foreground">
                {tables.find((t) => t.name === selectedTable)?.rows.toLocaleString() ?? '?'} rows
              </span>
              {tableSchema && (
                <span className="text-xs text-muted-foreground">{tableSchema.length} columns</span>
              )}
            </div>

            {/* Schema */}
            {tableSchema && (
              <div className="flex flex-wrap gap-1">
                {tableSchema.map((col) => (
                  <span
                    key={col.name}
                    className="text-xs bg-muted px-1.5 py-0.5 rounded"
                    title={col.type}
                  >
                    {col.name}
                  </span>
                ))}
              </div>
            )}

            {/* Data preview */}
            {previewLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : previewRows && previewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      {Object.keys(previewRows[0]).map((col) => (
                        <th
                          key={col}
                          className="text-left p-1.5 border-b font-medium bg-muted/50 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-accent/50">
                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            className="p-1.5 border-b whitespace-nowrap max-w-[200px] truncate"
                          >
                            {val === null ? (
                              <span className="text-muted-foreground italic">null</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data in this table</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
