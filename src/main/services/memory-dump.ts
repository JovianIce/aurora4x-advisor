import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { auroraBridge } from './aurora-bridge'

interface CollectionEntry {
  field: string
  collectionType: string
  keyType: string | null
  itemType: string
  count: number
  fieldCount: number
  schema: { name: string; type: string }[]
}

interface DumpResult {
  outputDir: string
  collections: number
  totalItems: number
  elapsedMs: number
  files: string[]
  errors: string[]
}

/**
 * Dump all GameState memory to JSON files.
 * Uses existing bridge endpoints: enumerateGameState, enumerateCollections, readCollection.
 * Writes one file per collection + index + gamestate fields.
 */
export async function dumpMemoryToFiles(outputDir: string): Promise<DumpResult> {
  const start = Date.now()
  const files: string[] = []
  const errors: string[] = []
  let totalItems = 0

  await mkdir(outputDir, { recursive: true })

  // 1. Dump all GameState fields (scalars, types, counts)
  try {
    const fields = await auroraBridge.enumerateGameState()
    const filePath = join(outputDir, '_gamestate_fields.json')
    await writeFile(filePath, JSON.stringify(fields, null, 2))
    files.push('_gamestate_fields.json')
  } catch (err) {
    errors.push(`gamestate fields: ${err}`)
  }

  // 2. Get all collections
  let collections: CollectionEntry[] = []
  try {
    collections = (await auroraBridge.enumerateCollections()) as CollectionEntry[]
    const indexPath = join(outputDir, '_collections_index.json')
    await writeFile(
      indexPath,
      JSON.stringify(
        collections.map((c) => ({
          field: c.field,
          itemType: c.itemType,
          collectionType: c.collectionType,
          count: c.count,
          fieldCount: c.fieldCount,
          file: `${c.field}_${c.itemType}_${c.count}.json`
        })),
        null,
        2
      )
    )
    files.push('_collections_index.json')
  } catch (err) {
    errors.push(`collections index: ${err}`)
  }

  // 3. Dump each collection with data
  for (const col of collections) {
    if (col.count === 0) continue

    const fileName = `${col.field}_${col.itemType}_${col.count}.json`
    try {
      // Read all items (no limit), include sub-object refs
      const items = await auroraBridge.readCollection({
        Field: col.field,
        Limit: col.count + 10, // ensure we get everything
        IncludeRefs: true
      })

      const fileData = {
        _field: col.field,
        _type: col.itemType,
        _collectionType: col.collectionType,
        _count: col.count,
        _dumped: (items as unknown[]).length,
        _schema: col.schema,
        items
      }

      await writeFile(join(outputDir, fileName), JSON.stringify(fileData, null, 2))
      files.push(fileName)
      totalItems += (items as unknown[]).length
    } catch (err) {
      errors.push(`${col.field}: ${err}`)
    }
  }

  return {
    outputDir,
    collections: collections.filter((c) => c.count > 0).length,
    totalItems,
    elapsedMs: Date.now() - start,
    files,
    errors
  }
}
