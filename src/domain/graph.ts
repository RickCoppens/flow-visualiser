import { createId, createTransformation, elements, isGap, type Canvas, type Dependency, type Transformation } from './model'

export function reachable(canvas: Canvas, roots: string[], collapsed = new Set<string>()): Set<string> {
  const valid = new Set(elements(canvas).map(element => element.id))
  const result = new Set<string>()
  const pending = [...roots]
  const children = new Map<string, string[]>()
  for (const edge of canvas.dependencies) children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target])
  while (pending.length) {
    const current = pending.pop()!
    if (result.has(current) || !valid.has(current)) continue
    result.add(current)
    if (!collapsed.has(current)) pending.push(...(children.get(current) ?? []))
  }
  return result
}
export function processMembers(canvas: Canvas, processId: string) {
  return reachable(canvas, canvas.dataPoints.filter(point => point.deliverableProcessIds.includes(processId)).map(point => point.id))
}
export function gapsBelow(canvas: Canvas, id: string, includeSelf = false) {
  const ids = reachable(canvas, [id])
  if (!includeSelf) ids.delete(id)
  return elements(canvas).filter(element => ids.has(element.id) && isGap(element))
}
export function roleFor(canvas: Canvas, id: string): 'source' | 'intermediate' | 'result' {
  const hasProducer = canvas.dependencies.some(edge => edge.source === id && canvas.transformations.some(item => item.id === edge.target))
  if (!hasProducer) return 'source'
  const deliverable = canvas.dataPoints.find(point => point.id === id)?.deliverableProcessIds.length
  return deliverable || !canvas.dependencies.some(edge => edge.target === id && canvas.transformations.some(item => item.id === edge.source)) ? 'result' : 'intermediate'
}
export function cycleEdges(canvas: Canvas): Set<string> {
  return new Set(canvas.dependencies.filter(edge => reachable(canvas, [edge.target]).has(edge.source)).map(edge => edge.id))
}
export interface Signal { elementId: string; message: string }
export function signalsFor(canvas: Canvas): Signal[] {
  const signals: Signal[] = []
  const members = new Set(canvas.processes.flatMap(process => [...processMembers(canvas, process.id)]))
  const cycles = cycleEdges(canvas)
  for (const element of elements(canvas)) {
    if (!members.has(element.id)) signals.push({ elementId: element.id, message: 'Hoort bij geen enkel proces.' })
  }
  for (const point of canvas.dataPoints) {
    const producers = canvas.dependencies.filter(edge => edge.source === point.id && canvas.transformations.some(item => item.id === edge.target))
    if (!producers.length) signals.push({ elementId: point.id, message: 'Brongegeven: waar komt dit vandaan?' })
    if (producers.length > 1) signals.push({ elementId: point.id, message: 'Meerdere producerende transformaties; beschrijf alternatieven als beslisregel.' })
  }
  for (const transformation of canvas.transformations) {
    const inputs = canvas.dependencies.filter(edge => edge.source === transformation.id && canvas.dataPoints.some(point => point.id === edge.target))
    const outputs = canvas.dependencies.filter(edge => edge.target === transformation.id && canvas.dataPoints.some(point => point.id === edge.source))
    if (!inputs.length) signals.push({ elementId: transformation.id, message: 'Transformatie zonder input.' })
    if (!outputs.length) signals.push({ elementId: transformation.id, message: 'Transformatie zonder output.' })
    if (outputs.length > 1) signals.push({ elementId: transformation.id, message: 'Transformatie met meerdere outputs; gebruik aparte transformaties.' })
    if (!transformation.logic.trim()) signals.push({ elementId: transformation.id, message: 'Logica is nog niet ingevuld.' })
  }
  for (const edge of canvas.dependencies) {
    if (cycles.has(edge.id)) signals.push({ elementId: edge.source, message: 'Cyclus: afhankelijkheid verwijst terug.' })
    const sourceIsPoint = canvas.dataPoints.some(point => point.id === edge.source)
    const targetIsPoint = canvas.dataPoints.some(point => point.id === edge.target)
    if (sourceIsPoint && targetIsPoint) signals.push({ elementId: edge.source, message: 'Transformatie nog niet beschreven. Klik op de pijl om een transformatie in te voegen.' })
    else if (!sourceIsPoint && !targetIsPoint) signals.push({ elementId: edge.source, message: 'Verbinding tussen transformaties; beschrijf het tussenliggende gegeven.' })
  }
  return signals
}
export function visibleElements(canvas: Canvas, processId: string, collapsed: Set<string>) {
  const allowed = processId ? processMembers(canvas, processId) : new Set(elements(canvas).map(element => element.id))
  const candidates = elements(canvas).filter(element => allowed.has(element.id))
  const incoming = new Set(canvas.dependencies.filter(edge => allowed.has(edge.source)).map(edge => edge.target))
  const roots = candidates.filter(element => !incoming.has(element.id) || (canvas.dataPoints.find(point => point.id === element.id)?.deliverableProcessIds.length ?? 0) > 0).map(element => element.id)
  // Cyclic components have no natural root: retain a stable entry for each component.
  const covered = reachable(canvas, roots)
  for (const element of candidates) if (!covered.has(element.id)) {
    roots.push(element.id)
    for (const id of reachable(canvas, [element.id])) covered.add(id)
  }
  return new Set([...reachable(canvas, roots, collapsed)].filter(id => allowed.has(id)))
}
export function removeElement(canvas: Canvas, id: string) {
  canvas.dataPoints = canvas.dataPoints.filter(point => point.id !== id)
  canvas.transformations = canvas.transformations.filter(transformation => transformation.id !== id)
  canvas.dependencies = canvas.dependencies.filter(edge => edge.source !== id && edge.target !== id)
}
export function addDependency(canvas: Canvas, dependency: Dependency) {
  if (!canvas.dependencies.some(edge => edge.source === dependency.source && edge.target === dependency.target)) canvas.dependencies.push(dependency)
}
export function insertTransformation(canvas: Canvas, edgeId: string, realization: Transformation['realization']) {
  const edge = canvas.dependencies.find(item => item.id === edgeId)
  if (!edge || !canvas.dataPoints.some(point => point.id === edge.source) || !canvas.dataPoints.some(point => point.id === edge.target)) {
    throw new Error('Deze verbinding is gewijzigd. Kies opnieuw een pijl tussen twee gegevens.')
  }
  const transformation = createTransformation(realization)
  canvas.transformations.push(transformation)
  canvas.dependencies = canvas.dependencies.filter(item => item.id !== edgeId)
  addDependency(canvas, { id: createId(), source: edge.source, target: transformation.id })
  addDependency(canvas, { id: createId(), source: transformation.id, target: edge.target })
  return transformation.id
}
