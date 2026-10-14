import { describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixtures.test-helper'
import { createTransformation, emptyWorkspace, realizationTypes, transformationTypes } from '../domain/model'
import { legacyCanvasSchema } from '../domain/migration'
import { exportCanvas, importCanvas } from './files'

describe('zelfstandige JSON-uitwisseling', () => {
  it('migreert v1-bestanden zonder logische typen of beschrijvingen te verliezen', () => {
    const source = fixture()
    const canvas = source.canvases[0]
    canvas.transformations = transformationTypes.map((type, index) => ({
      ...createTransformation(), id: `legacy-${index}`, name: 'Bewerkingslabel', type, logic: 'Logische beschrijving', notes: 'Ontwerpnotitie',
    }))
    canvas.dependencies = []
    const legacy = legacyCanvasSchema.parse({ ...canvas, schemaVersion: 1 })
    const result = importCanvas(JSON.stringify({ schemaVersion: 1, canvas: legacy, catalog: source.catalog }), emptyWorkspace())
    const imported = result.workspace.canvases[0]
    expect(imported.schemaVersion).toBe(2)
    expect(imported.transformations.map(item => item.type)).toEqual([...transformationTypes])
    expect(imported.transformations.every(item => item.realization === 'automation' && item.availability === 'undetermined' && item.logic === 'Logische beschrijving' && item.notes === 'Ontwerpnotitie')).toBe(true)
  })
  it('behoudt alle typespecifieke eigenschappen, beschikbaarheid en EPIC in v2', () => {
    const source = fixture()
    const canvas = source.canvases[0]
    canvas.transformations = realizationTypes.map(realization => ({
      ...createTransformation(realization), availability: 'toBuild', epic: 'EPIC-verwijzing',
      interaction: 'both', apiOperation: 'Operatielabel', logic: 'Werkingbeschrijving',
      conditions: 'Beschrijving voorwaarden', guardrails: 'Beschrijving kaders', humanReview: 'Beschrijving controle',
    }))
    canvas.dependencies = []
    const imported = importCanvas(exportCanvas(canvas, source.catalog), emptyWorkspace()).workspace.canvases[0]
    expect(imported.transformations).toEqual(canvas.transformations.map(item => ({ ...item, id: expect.any(String) })))
  })
  it('maakt een zelfstandige roundtrip en remapt identifiers bij herhaalde import', () => {
    const source = fixture()
    const text = exportCanvas(source.canvases[0], source.catalog)
    const first = importCanvas(text, emptyWorkspace())
    const second = importCanvas(text, first.workspace)
    expect(first.workspace.canvases[0].dependencies).toHaveLength(4)
    expect(second.workspace.canvases).toHaveLength(2)
    expect(second.workspace.catalog).toHaveLength(3)
    expect(second.workspace.canvases[0].id).not.toBe(second.workspace.canvases[1].id)
    const originalIds = new Set(source.canvases[0].dataPoints.map(point => point.id))
    expect(first.workspace.canvases[0].dataPoints.every(point => !originalIds.has(point.id))).toBe(true)
    expect(second.workspace.canvases[0]).toEqual(first.workspace.canvases[0])
  })
  it('behoudt beide definities zonder bestaande canvassen te wijzigen', () => {
    const source = fixture()
    const local = structuredClone(source)
    local.catalog[0].definition = 'Lokale definitie'
    source.catalog[0].definition = 'Geïmporteerde definitie'
    const before = JSON.stringify(local)
    const result = importCanvas(exportCanvas(source.canvases[0], source.catalog), local)
    expect(JSON.stringify(local)).toBe(before)
    expect(result.conflicts).toHaveLength(1)
    expect(result.workspace.catalog).toHaveLength(4)
    const imported = result.workspace.canvases.at(-1)!
    const item = result.workspace.catalog.find(item => item.id === imported.dataPoints[0].catalogItemId)!
    expect(item.term).toBe('Resultaat (import)')
    expect(item.definition).toBe('Geïmporteerde definitie')
    expect(result.workspace.catalog[0].definition).toBe('Lokale definitie')
  })
  it('behoudt inhoudelijke conflicten en onvolledige transformaties', () => {
    const source = fixture()
    source.canvases[0].dependencies.push({ id: 'conflict', source: 'point-0', target: 'transform-b' }, { id: 'cycle', source: 'point-2', target: 'transform-a' })
    expect(importCanvas(exportCanvas(source.canvases[0], source.catalog), emptyWorkspace()).workspace.canvases[0].dependencies).toHaveLength(6)
  })
  it('weigert corrupte of nieuwere bestanden zonder mutatie', () => {
    const local = fixture()
    const before = JSON.stringify(local)
    expect(() => importCanvas('{', local)).toThrow('leesbare JSON')
    expect(() => importCanvas('{"schemaVersion":999}', local)).toThrow('niet ondersteund')
    expect(() => importCanvas('{"schemaVersion":1}', local)).toThrow('bestandsstructuur')
    const file = JSON.parse(exportCanvas(local.canvases[0], local.catalog))
    file.canvas.dependencies[0].target = 'unknown'
    expect(() => importCanvas(JSON.stringify(file), local)).toThrow('ontbrekende verwijzingen')
    expect(JSON.stringify(local)).toBe(before)
  })
  it('weigert dubbele identifiers en ontbrekende catalogussnapshots', () => {
    const source = fixture()
    const file = JSON.parse(exportCanvas(source.canvases[0], source.catalog))
    file.canvas.dataPoints[1].id = file.canvas.dataPoints[0].id
    expect(() => importCanvas(JSON.stringify(file), source)).toThrow('dubbele identifiers')
    const missing = JSON.parse(exportCanvas(source.canvases[0], []))
    expect(() => importCanvas(JSON.stringify(missing), source)).toThrow('ontbrekende verwijzingen')
  })
})
