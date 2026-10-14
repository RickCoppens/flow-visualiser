import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixtures.test-helper'
import { FlowDatabase, loadWorkspace, saveWorkspace } from './database'
import { commit, createHistory, redo, undo } from '../state/history'
import type { Workspace } from '../domain/model'
import Dexie from 'dexie'
import { legacyCanvasSchema } from '../domain/migration'

const opened: FlowDatabase[] = []
function openDatabase() {
  const db = new FlowDatabase(crypto.randomUUID())
  opened.push(db)
  return db
}
afterEach(async () => { await Promise.all(opened.splice(0).map(db => db.delete())) })
const sorted = (workspace: Workspace) => ({
  canvases: [...workspace.canvases].sort((a, b) => a.id.localeCompare(b.id)),
  catalog: [...workspace.catalog].sort((a, b) => a.id.localeCompare(b.id)),
})

describe('lokale opslag en herstel', () => {
  it('migreert IndexedDB v1 naar v2 en behoudt bestaande logica, ids, relaties en catalogus', async () => {
    const db = openDatabase()
    const workspace = fixture()
    const canvas = workspace.canvases[0]
    canvas.transformations[0].logic = 'Beschrijving van de bestaande afleiding'
    const legacy = legacyCanvasSchema.parse({ ...canvas, schemaVersion: 1 })
    const old = new Dexie(db.name)
    old.version(1).stores({ canvases: 'id, updatedAt', catalog: 'id, &term' })
    await old.table('canvases').put(legacy)
    await old.table('catalog').bulkPut(workspace.catalog)
    old.close()
    const loaded = await loadWorkspace(db)
    expect(loaded.canvases[0]).toEqual(canvas)
    expect(loaded.canvases[0].schemaVersion).toBe(2)
    expect(loaded.canvases[0].transformations.every(item => item.realization === 'automation' && item.availability === 'undetermined')).toBe(true)
    expect(sorted(loaded).catalog).toEqual(sorted(workspace).catalog)
    db.close()
    await db.open()
    expect(await loadWorkspace(db)).toEqual(loaded)
  })
  it('bewaart en heropent canvassen met globale catalogus', async () => {
    const db = openDatabase()
    const workspace = fixture()
    await saveWorkspace(workspace, db)
    expect(sorted(await loadWorkspace(db))).toEqual(sorted(workspace))
    db.close()
    await db.open()
    expect(sorted(await loadWorkspace(db))).toEqual(sorted(workspace))
  })
  it('rolt een mislukte transactie volledig terug', async () => {
    const db = openDatabase()
    const workspace = fixture()
    await saveWorkspace(workspace, db)
    const invalid = structuredClone(workspace)
    invalid.catalog[1].term = invalid.catalog[0].term
    await expect(saveWorkspace(invalid, db)).rejects.toBeDefined()
    expect(sorted(await loadWorkspace(db))).toEqual(sorted(workspace))
  })
  it('herstelt catalogusbewerkingen voor alle canvassen, ook in opslag', async () => {
    const db = openDatabase()
    const initial = fixture()
    initial.canvases.push({ ...structuredClone(initial.canvases[0]), id: 'another-canvas' })
    const next = structuredClone(initial)
    next.catalog[0].term = 'Gewijzigd resultaatlabel'
    let history = commit(createHistory(initial), next)
    await saveWorkspace(history.present, db)
    expect((await loadWorkspace(db)).catalog.find(item => item.id === initial.catalog[0].id)!.term).toBe('Gewijzigd resultaatlabel')
    history = undo(history)
    await saveWorkspace(history.present, db)
    expect(sorted(await loadWorkspace(db))).toEqual(sorted(initial))
    history = redo(history)
    expect(history.present).toEqual(next)
    expect(history.present.canvases.every(canvas => canvas.dataPoints[0].catalogItemId === next.catalog[0].id)).toBe(true)
    expect(commit(undo(history), initial).future).toHaveLength(0)
  })
})
