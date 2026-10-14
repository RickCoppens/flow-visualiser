import { describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixtures.test-helper'
import { layoutGraph } from './layout'
import { createTransformation } from '../domain/model'

describe('ELK-layoutproef', () => {
  it('tekent gedeelde knooppunten eenmaal, top-down en zonder overlap', async () => {
    const { catalog, canvases: [canvas] } = fixture()
    catalog[0].term = 'Een lang label voor het gewenste resultaat dat leesbaar moet blijven'
    const layout = await layoutGraph(canvas, catalog, '', new Set())
    expect(layout.size).toBe(5)
    expect(layout.get('point-0')!.y).toBeLessThan(layout.get('transform-a')!.y)
    expect(layout.get('transform-a')!.y).toBeLessThan(layout.get('point-2')!.y)
    const positions = [...layout.values()]
    for (let left = 0; left < positions.length; left++) for (let right = left + 1; right < positions.length; right++) {
      expect(Math.abs(positions[left].x - positions[right].x) >= 248 || Math.abs(positions[left].y - positions[right].y) >= 190).toBe(true)
    }
  })
  it('blijft eindig bij cycli en losse elementen, ook na inklappen', async () => {
    const { catalog, canvases: [canvas] } = fixture()
    canvas.dependencies.push({ id: 'cycle', source: 'point-2', target: 'transform-a' })
    canvas.transformations.push({ ...createTransformation(), id: 'loose', name: 'Losse transformatie', type: 'interpretation', status: 'assumed' })
    const before = JSON.stringify(canvas)
    for (const collapsed of [new Set<string>(), new Set(['transform-a']), new Set<string>()]) {
      const layout = await layoutGraph(canvas, catalog, '', collapsed)
      expect(layout.has('loose')).toBe(true)
      for (const position of layout.values()) {
        expect(Number.isFinite(position.x)).toBe(true)
        expect(Number.isFinite(position.y)).toBe(true)
      }
    }
    expect(JSON.stringify(canvas)).toBe(before)
  })
})
