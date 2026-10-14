import { z } from 'zod'
import { SCHEMA_VERSION, createId, exportSchema, uniqueTerm, type Canvas, type CatalogItem, type Workspace } from '../domain/model'
import { migrateLegacyFile } from '../domain/migration'

export function exportCanvas(canvas: Canvas, catalog: CatalogItem[]) {
  const used = new Set(canvas.dataPoints.map(point => point.catalogItemId))
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, canvas, catalog: catalog.filter(item => used.has(item.id)) }, null, 2)
}

export function migrateFile(value: unknown): unknown {
  const header = z.object({ schemaVersion: z.number() }).safeParse(value)
  if (!header.success) throw new Error('Schemaversie ontbreekt. Kies een Flow Visualiser-exportbestand.')
  if (header.data.schemaVersion === 1) return migrateLegacyFile(value)
  if (header.data.schemaVersion !== SCHEMA_VERSION) throw new Error(`Schemaversie ${header.data.schemaVersion} wordt niet ondersteund. Dit bestand is niet geïmporteerd.`)
  return value
}
function sameCatalogContent(left: CatalogItem, right: CatalogItem) {
  return left.term === right.term && left.definition === right.definition &&
    left.owner === right.owner && left.qualityCriteria === right.qualityCriteria &&
    left.cardinality === right.cardinality &&
    JSON.stringify(left.synonyms) === JSON.stringify(right.synonyms) &&
    JSON.stringify(left.deprecatedTerms) === JSON.stringify(right.deprecatedTerms)
}
export function importCanvas(text: string, existing: Workspace): { workspace: Workspace; canvasId: string; conflicts: string[] } {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('Dit bestand bevat geen leesbare JSON. Er is niets gewijzigd.') }
  const result = exportSchema.safeParse(migrateFile(parsed))
  if (!result.success) throw new Error('De bestandsstructuur is ongeldig of onvolledig. Er is niets gewijzigd.')
  const file = result.data
  const allIds = [...file.canvas.dataPoints, ...file.canvas.transformations, ...file.canvas.processes, ...file.canvas.dependencies, ...file.catalog].map(item => item.id)
  if (new Set(allIds).size !== allIds.length) throw new Error('Het bestand bevat dubbele identifiers. Er is niets gewijzigd.')
  const elementIds = new Set([...file.canvas.dataPoints, ...file.canvas.transformations].map(item => item.id))
  const catalogIds = new Set(file.catalog.map(item => item.id))
  const processIds = new Set(file.canvas.processes.map(item => item.id))
  if (file.canvas.dependencies.some(edge => !elementIds.has(edge.source) || !elementIds.has(edge.target)) ||
      file.canvas.dataPoints.some(point => !catalogIds.has(point.catalogItemId) || point.deliverableProcessIds.some(id => !processIds.has(id)))) {
    throw new Error('Het bestand bevat ontbrekende verwijzingen. Er is niets gewijzigd.')
  }
  const workspace = structuredClone(existing)
  const catalogMap = new Map<string, string>()
  const conflicts: string[] = []
  for (const item of file.catalog) {
    const match = workspace.catalog.find(local => sameCatalogContent(local, item))
    if (match) { catalogMap.set(item.id, match.id); continue }
    const conflict = workspace.catalog.some(local => local.term.toLocaleLowerCase('nl') === item.term.toLocaleLowerCase('nl'))
    const term = uniqueTerm(workspace.catalog, conflict ? `${item.term} (import)` : item.term)
    if (conflict) conflicts.push(`${item.term} is behouden als ${term}.`)
    const imported = { ...item, id: createId(), term }
    catalogMap.set(item.id, imported.id)
    workspace.catalog.push(imported)
  }
  const idMap = new Map(allIds.map(id => [id, createId()]))
  const canvas: Canvas = {
    ...file.canvas, id: createId(), updatedAt: new Date().toISOString(),
    processes: file.canvas.processes.map(process => ({ ...process, id: idMap.get(process.id)! })),
    dataPoints: file.canvas.dataPoints.map(point => ({
      ...point, id: idMap.get(point.id)!, catalogItemId: catalogMap.get(point.catalogItemId)!,
      deliverableProcessIds: point.deliverableProcessIds.map(id => idMap.get(id)!),
    })),
    transformations: file.canvas.transformations.map(transformation => ({ ...transformation, id: idMap.get(transformation.id)! })),
    dependencies: file.canvas.dependencies.map(edge => ({ id: idMap.get(edge.id)!, source: idMap.get(edge.source)!, target: idMap.get(edge.target)! })),
  }
  workspace.canvases.push(canvas)
  return { workspace, canvasId: canvas.id, conflicts }
}
