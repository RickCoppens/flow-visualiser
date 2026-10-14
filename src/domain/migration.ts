import { z } from 'zod'
import { canvasSchema, catalogItemSchema, createTransformation, transformationSchema, transformationTypes } from './model'

const legacyTransformationSchema = transformationSchema.pick({
  id: true, name: true, logic: true, status: true, notes: true,
}).extend({ type: z.enum(transformationTypes) })
export const legacyCanvasSchema = canvasSchema.extend({
  schemaVersion: z.literal(1),
  transformations: z.array(legacyTransformationSchema),
})
const legacyExportSchema = z.object({
  schemaVersion: z.literal(1), canvas: legacyCanvasSchema, catalog: z.array(catalogItemSchema),
})

export function migrateCanvas(value: unknown) {
  const legacy = legacyCanvasSchema.parse(value)
  return canvasSchema.parse({
    ...legacy, schemaVersion: 2,
    transformations: legacy.transformations.map(item => ({ ...createTransformation('automation'), ...item })),
  })
}

export function migrateLegacyFile(value: unknown) {
  const file = legacyExportSchema.safeParse(value)
  if (!file.success) throw new Error('De bestandsstructuur is ongeldig of onvolledig. Er is niets gewijzigd.')
  return { ...file.data, schemaVersion: 2, canvas: migrateCanvas(file.data.canvas) }
}
