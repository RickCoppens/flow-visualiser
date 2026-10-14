import Dexie, { type Table } from 'dexie'
import { canvasSchema, catalogItemSchema, type Canvas, type CatalogItem, type Workspace } from '../domain/model'
import { migrateCanvas } from '../domain/migration'

export class FlowDatabase extends Dexie {
  canvases!: Table<Canvas, string>
  catalog!: Table<CatalogItem, string>
  constructor(name = 'flow-visualiser') {
    super(name)
    this.version(1).stores({ canvases: 'id, updatedAt', catalog: 'id, &term' })
    this.version(2).stores({ canvases: 'id, updatedAt', catalog: 'id, &term' }).upgrade(transaction =>
      transaction.table('canvases').toCollection().modify(canvas => {
        Object.assign(canvas, migrateCanvas(canvas))
      }))
  }
}
export const database = new FlowDatabase()

export async function loadWorkspace(db = database): Promise<Workspace> {
  return db.transaction('r', db.canvases, db.catalog, async () => ({
    canvases: (await db.canvases.toArray()).map(canvas => canvasSchema.parse(canvas)),
    catalog: (await db.catalog.toArray()).map(item => catalogItemSchema.parse(item)),
  }))
}
export async function saveWorkspace(workspace: Workspace, db = database) {
  await db.transaction('rw', db.canvases, db.catalog, async () => {
    await db.canvases.clear()
    await db.catalog.clear()
    if (workspace.canvases.length) await db.canvases.bulkPut(workspace.canvases)
    if (workspace.catalog.length) await db.catalog.bulkPut(workspace.catalog)
  })
}
