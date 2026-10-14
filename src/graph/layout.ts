import ELK from 'elkjs/lib/elk.bundled.js'
import { elements, labelFor, type Canvas, type CatalogItem } from '../domain/model'
import { visibleElements } from '../domain/graph'

const elk = new ELK()
export const NODE_WIDTH = 248
export const NODE_HEIGHT = 190
export const LAYER_SPACING = 72
export async function layoutGraph(canvas: Canvas, catalog: CatalogItem[], processId: string, collapsed: Set<string>) {
  const visible = visibleElements(canvas, processId, collapsed)
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYER_SPACING),
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: elements(canvas).filter(element => visible.has(element.id)).map(element => ({
      id: element.id, width: NODE_WIDTH, height: NODE_HEIGHT,
      labels: [{ text: labelFor(element, catalog) }],
    })),
    edges: canvas.dependencies.filter(edge => visible.has(edge.source) && visible.has(edge.target) && !collapsed.has(edge.source))
      .map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  })
  return new Map((graph.children ?? []).map(child => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]))
}
