import { z } from 'zod'

export const SCHEMA_VERSION = 2
const id = z.string().min(1)
export const catalogItemSchema = z.object({
  id,
  term: z.string().min(1),
  definition: z.string(),
  synonyms: z.array(z.string()),
  deprecatedTerms: z.array(z.string()),
  owner: z.string(),
  qualityCriteria: z.string(),
  cardinality: z.enum(['single', 'list']),
})
export const dataPointSchema = z.object({
  id, catalogItemId: id,
  status: z.enum(['known', 'assumed', 'missing']),
  deliverableProcessIds: z.array(id),
  notes: z.string(),
})
export const transformationTypes = ['calculation', 'decision', 'lookup', 'extraction', 'validation', 'interpretation'] as const
export const realizationTypes = ['forcze', 'api', 'automation', 'agentic'] as const
export const realizationLabels = { forcze: 'Forcze-uitvraag/beoordeling', api: 'API', automation: 'Automatisering', agentic: 'Agentic / genAI' }
export const availabilityLabels = { available: 'Beschikbaar', toBuild: 'Nog te bouwen', undetermined: 'Nog te bepalen' }
export const transformationSchema = z.object({
  id, name: z.string(),
  type: z.enum(['', ...transformationTypes]),
  logic: z.string(),
  status: z.enum(['described', 'undescribed', 'assumed']),
  notes: z.string(),
  realization: z.enum(realizationTypes),
  availability: z.enum(['available', 'toBuild', 'undetermined']),
  epic: z.string(),
  interaction: z.enum(['request', 'assessment', 'both']),
  apiOperation: z.string(),
  conditions: z.string(),
  guardrails: z.string(),
  humanReview: z.string(),
})
export const dependencySchema = z.object({ id, source: id, target: id })
export const processSchema = z.object({ id, name: z.string(), description: z.string() })
export const canvasSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id, name: z.string(),
  createdAt: z.string(), updatedAt: z.string(),
  dataPoints: z.array(dataPointSchema),
  transformations: z.array(transformationSchema),
  dependencies: z.array(dependencySchema),
  processes: z.array(processSchema),
})
export const workspaceSchema = z.object({
  canvases: z.array(canvasSchema),
  catalog: z.array(catalogItemSchema),
})
export const exportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  canvas: canvasSchema,
  catalog: z.array(catalogItemSchema),
})
export type CatalogItem = z.infer<typeof catalogItemSchema>
export type DataPoint = z.infer<typeof dataPointSchema>
export type Transformation = z.infer<typeof transformationSchema>
export type Dependency = z.infer<typeof dependencySchema>
export type Process = z.infer<typeof processSchema>
export type Canvas = z.infer<typeof canvasSchema>
export type Workspace = z.infer<typeof workspaceSchema>
export type Element = DataPoint | Transformation
export const createId = () => crypto.randomUUID()
export function createTransformation(realization: Transformation['realization'] = 'automation'): Transformation {
  return {
    id: createId(), name: 'Nieuwe transformatie', type: '', logic: '', status: 'undescribed', notes: '',
    realization, availability: 'undetermined', epic: '', interaction: 'request', apiOperation: '',
    conditions: '', guardrails: '', humanReview: '',
  }
}
export const emptyWorkspace = (): Workspace => ({ canvases: [], catalog: [] })
export function createCanvas(name = 'Nieuw canvas'): Canvas {
  const now = new Date().toISOString()
  return { schemaVersion: SCHEMA_VERSION, id: createId(), name, createdAt: now, updatedAt: now, dataPoints: [], transformations: [], dependencies: [], processes: [] }
}
export function uniqueTerm(catalog: CatalogItem[], preferred: string): string {
  const term = preferred.trim() || 'Nieuw datapunt'
  let result = term
  let index = 2
  while (catalog.some(item => item.term.toLocaleLowerCase('nl') === result.toLocaleLowerCase('nl'))) result = `${term} (${index++})`
  return result
}
export function createCatalogItem(catalog: CatalogItem[], term = 'Nieuw datapunt'): CatalogItem {
  return { id: createId(), term: uniqueTerm(catalog, term), definition: '', synonyms: [], deprecatedTerms: [], owner: '', qualityCriteria: '', cardinality: 'single' }
}
export const elements = (canvas: Canvas): Element[] => [...canvas.dataPoints, ...canvas.transformations]
export const isDataPoint = (element: Element): element is DataPoint => 'catalogItemId' in element
export const isGap = (element: Element) => element.status !== 'known' && element.status !== 'described'
export const labelFor = (element: Element, catalog: CatalogItem[]) => isDataPoint(element)
  ? catalog.find(item => item.id === element.catalogItemId)?.term ?? 'Catalogusverwijzing ontbreekt'
  : element.name || 'Naamloze transformatie'
