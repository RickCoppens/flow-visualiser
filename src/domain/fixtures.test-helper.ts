import { createCanvas, createCatalogItem, createTransformation, type DataPoint, type Workspace } from './model'

export function fixture(): Workspace {
  const canvas = createCanvas('Ontwerp')
  const catalog = ['Resultaat', 'Bronlabel', 'Gedeeld label'].map(term => createCatalogItem([], term))
  canvas.processes = [{ id: 'process-a', name: 'Proces A', description: '' }, { id: 'process-b', name: 'Proces B', description: '' }]
  canvas.dataPoints = catalog.map((item, index): DataPoint => ({
    id: `point-${index}`, catalogItemId: item.id, status: 'missing', notes: '',
    deliverableProcessIds: index === 0 ? ['process-a'] : index === 1 ? ['process-b'] : [],
  }))
  canvas.transformations = ['transform-a', 'transform-b'].map((id, index) => ({ ...createTransformation(), id, name: `Bewerking ${index === 0 ? 'A' : 'B'}`, type: 'calculation' }))
  canvas.dependencies = [
    { id: 'edge-a', source: 'point-0', target: 'transform-a' },
    { id: 'edge-b', source: 'transform-a', target: 'point-2' },
    { id: 'edge-c', source: 'point-1', target: 'transform-b' },
    { id: 'edge-d', source: 'transform-b', target: 'point-2' },
  ]
  return { catalog, canvases: [canvas] }
}
