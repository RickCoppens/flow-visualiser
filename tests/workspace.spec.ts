import { test, expect, type Page } from '@playwright/test'
import { fixture } from '../src/domain/fixtures.test-helper'
import { exportCanvas } from '../src/exchange/files'
import { legacyCanvasSchema } from '../src/domain/migration'
import { createTransformation } from '../src/domain/model'

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) await info.attach('graafdiagnose', {
    contentType: 'application/json',
    body: JSON.stringify(await page.evaluate(() => ({
      nodes: [...document.querySelectorAll('.react-flow__node')].map(node => ({ label: node.getAttribute('aria-label'), style: node.getAttribute('style'), rectangle: node.getBoundingClientRect().toJSON() })),
      viewport: document.querySelector('.react-flow__viewport')?.getAttribute('style'),
      canvas: document.querySelector('.graph-wrap')?.getBoundingClientRect().toJSON(),
      edges: document.querySelector('.react-flow__edges')?.outerHTML,
      handles: [...document.querySelectorAll('.react-flow__handle')].map(handle => ({ class: handle.className, bounds: handle.getBoundingClientRect().toJSON() })),
    })), null, 2),
  })
})

async function startCanvas(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Maak je eerste canvas', exact: true }).click()
  await page.getByRole('button', { name: 'Voeg je eerste deliverable toe', exact: true }).click()
  await expect(page.getByLabel('Status datapunt')).toHaveValue('missing')
}
async function editLabel(page: Page, term: string) {
  await page.getByRole('button', { name: 'Item bewerken', exact: true }).click()
  await page.getByLabel('Term', { exact: true }).fill(term)
  await page.getByLabel('Term', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Eigenschappen', exact: true }).click()
}
async function saved(page: Page) {
  await expect(page.getByText('Lokaal opgeslagen', { exact: false })).toBeVisible()
}

test('eerste beslisboom, bewerken, gaten, undo en herladen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const external: string[] = []
  page.on('request', request => { if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) external.push(request.url()) })
  await startCanvas(page)
  await editLabel(page, 'Resultaatlabel')
  await expect(page.locator('.element-node strong').filter({ hasText: 'Resultaatlabel' })).toBeVisible()
  await page.getByRole('button', { name: 'Input toevoegen: Resultaatlabel', exact: true }).click()
  await page.getByRole('button', { name: '+ Nieuw inputgegeven', exact: true }).click()
  await editLabel(page, 'Bronlabel')
  await page.getByRole('button', { name: 'Transformatie invoegen', exact: true }).click()
  await page.getByRole('button', { name: /^Automatisering/ }).click()
  await page.getByLabel('Naam transformatie').fill('Afleidingsregel')
  await page.getByLabel('Naam transformatie').press('Tab')
  await page.getByLabel('Businessrule', { exact: true }).fill('Beschrijving van benodigde afleiding')
  await page.getByLabel('Businessrule', { exact: true }).press('Tab')
  await expect(page.locator('.element-node')).toHaveCount(3)
  await page.getByRole('group', { name: 'Bronlabel', exact: true }).click()
  await page.getByLabel('Status datapunt').selectOption('known')
  await page.getByRole('button', { name: /Ongedaan/, exact: false }).click()
  await expect(page.getByLabel('Status datapunt')).toHaveValue('missing')
  await page.getByRole('button', { name: /Opnieuw/, exact: false }).click()
  await expect(page.getByLabel('Status datapunt')).toHaveValue('known')
  await saved(page)
  await page.reload()
  await expect(page.locator('.element-node')).toHaveCount(3)
  await expect(page.locator('.element-node strong').filter({ hasText: 'Bronlabel' })).toBeVisible()
  await page.getByRole('button', { name: 'Gaten', exact: true }).click()
  await expect(page.getByText('2 unieke gaten, inclusief de deliverable')).toBeVisible()
  await expect(page.getByText('Brongegeven: waar komt dit vandaan?')).toBeVisible()
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('import/export, catalogusconflict en corrupte import', async ({ page }) => {
  await startCanvas(page)
  await editLabel(page, 'Resultaatlabel')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporteren', exact: true }).click()
  const download = await downloading
  const path = await download.path()
  expect(path).toBeTruthy()
  await page.getByRole('button', { name: 'Item bewerken', exact: true }).click()
  await page.getByLabel('Definitie', { exact: true }).fill('Lokale omschrijving')
  await page.getByLabel('Definitie', { exact: true }).press('Tab')
  await page.locator('input[type=file]').setInputFiles(path!)
  await expect(page.getByRole('status')).toContainText('Catalogusconflicten')
  await expect(page.locator('.canvas-list button')).toHaveCount(2)
  await expect(page.locator('.element-node strong')).toContainText('Resultaatlabel (import)')
  await page.locator('input[type=file]').setInputFiles({ name: 'onleesbaar.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('alert')).toContainText('geen leesbare JSON')
  await expect(page.locator('.canvas-list button')).toHaveCount(2)
})

test('cataloguswijziging over canvassen en herstel, veilig verwijderen', async ({ page }) => {
  await startCanvas(page)
  await editLabel(page, 'Gedeelde term')
  await page.getByLabel('Nieuw canvas', { exact: true }).click()
  await page.getByRole('button', { name: 'Voeg je eerste deliverable toe', exact: true }).click()
  await page.getByRole('combobox', { name: 'Catalogusitem', exact: true }).selectOption({ label: 'Gedeelde term' })
  await editLabel(page, 'Gewijzigde term')
  await page.locator('.canvas-list button').first().click()
  await expect(page.locator('.element-node strong')).toContainText('Gewijzigde term')
  await page.getByRole('button', { name: /Ongedaan/ }).click()
  await expect(page.locator('.element-node strong')).toContainText('Gedeelde term')
  await page.locator('.element-node').click()
  await page.getByRole('button', { name: 'Item bewerken', exact: true }).click()
  await page.getByRole('button', { name: 'Catalogusitem verwijderen', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('in gebruik en blijft behouden')
  await page.getByRole('button', { name: 'Eigenschappen', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Element verwijderen', exact: true }).click()
  await expect(page.locator('.element-node')).toHaveCount(0)
  await page.getByRole('button', { name: /Ongedaan/ }).click()
  await expect(page.locator('.element-node')).toHaveCount(1)
})

test('toetsenbordbediening en smal scherm', async ({ page }) => {
  await startCanvas(page)
  await page.getByRole('button', { name: 'Eigenschappen', exact: true }).focus()
  await page.keyboard.press('Alt+t')
  await page.getByRole('button', { name: /^Automatisering/ }).click()
  await expect(page.getByLabel('Naam transformatie')).toBeVisible()
  await page.getByRole('button', { name: 'Eigenschappen', exact: true }).focus()
  await page.keyboard.press('Alt+d')
  await expect(page.locator('.element-node')).toHaveCount(3)
  await page.getByRole('button', { name: 'Selectie sluiten', exact: true }).click()
  await page.getByRole('group', { name: 'Nieuw resultaat', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Status datapunt')).toBeVisible()
  await page.setViewportSize({ width: 760, height: 900 })
  await expect(page.getByRole('button', { name: 'Eigenschappen', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('gedeelde takken, procesfilter, cycli en producerconflicten', async ({ page }) => {
  const workspace = fixture()
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Maak je eerste canvas', exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({
    name: 'ontwerp.json', mimeType: 'application/json',
    buffer: Buffer.from(exportCanvas(workspace.canvases[0], workspace.catalog)),
  })
  await expect(page.locator('.element-node')).toHaveCount(5)
  await expect(page.locator('.node-kind span').filter({ hasText: 'Gedeeld' })).toHaveCount(1)
  await page.locator('.process-list button').filter({ hasText: /^Proces A/ }).click()
  await expect(page.locator('.element-node')).toHaveCount(3)
  await page.getByRole('button', { name: 'Alle processen', exact: true }).click()
  await page.getByRole('button', { name: 'Inklappen: Resultaat', exact: true }).click()
  await expect(page.locator('.element-node')).toHaveCount(4)
  await page.getByRole('button', { name: 'Inklappen: Bronlabel', exact: true }).click()
  await expect(page.locator('.element-node')).toHaveCount(2)
  await page.getByRole('button', { name: 'Uitklappen: Resultaat', exact: true }).click()
  await page.getByRole('button', { name: 'Uitklappen: Bronlabel', exact: true }).click()
  await expect(page.locator('.element-node')).toHaveCount(5)
  await page.getByRole('group', { name: 'Resultaat', exact: true }).click()
  await page.getByLabel('Bestaand element koppelen').selectOption({ label: 'Bewerking B' })
  await page.getByRole('button', { name: 'Verbinding toevoegen', exact: true }).click()
  await expect(page.getByText(/Meerdere producerende transformaties/)).toBeVisible()
  await page.getByRole('group', { name: 'Gedeeld label', exact: true }).click()
  await page.getByLabel('Bestaand element koppelen').selectOption({ label: 'Bewerking A' })
  await page.getByRole('button', { name: 'Verbinding toevoegen', exact: true }).click()
  await expect(page.getByText(/Cyclus: afhankelijkheid verwijst terug/)).toBeVisible()
  await expect(page.locator('.element-node')).toHaveCount(5)
  await saved(page)
})

test('termen met spaties en meerdere synoniemen blijven invoerbaar', async ({ page }) => {
  await startCanvas(page)
  await page.getByRole('button', { name: 'Item bewerken', exact: true }).click()
  await page.getByLabel('Term', { exact: true }).fill('')
  await page.getByLabel('Term', { exact: true }).pressSequentially('Gewenst resultaatlabel')
  await page.getByLabel('Term', { exact: true }).press('Tab')
  await expect(page.getByLabel('Term', { exact: true })).toHaveValue('Gewenst resultaatlabel')
  await page.getByLabel('Synoniemen', { exact: true }).pressSequentially('Alternatief label')
  await page.getByLabel('Synoniemen', { exact: true }).press('Enter')
  await page.getByLabel('Synoniemen', { exact: true }).pressSequentially('Tweede label')
  await expect(page.getByLabel('Synoniemen', { exact: true })).toHaveValue('Alternatief label\nTweede label')
  await saved(page)
})

test('werkruimte op desktop en kleiner scherm vastleggen', async ({ page }) => {
  const workspace = fixture()
  const canvas = workspace.canvases[0]
  canvas.transformations[0].realization = 'api'
  canvas.transformations[0].availability = 'toBuild'
  canvas.transformations[1].availability = 'available'
  canvas.transformations.push({ ...createTransformation('forcze'), name: 'Uitvraag of beoordeling in Forcze' }, { ...createTransformation('agentic'), name: 'Beschrijving van agentic afleiding' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Maak je eerste canvas', exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'ontwerp.json', mimeType: 'application/json', buffer: Buffer.from(exportCanvas(workspace.canvases[0], workspace.catalog)) })
  await expect(page.getByRole('group', { name: 'Resultaat', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Alles in beeld', exact: true }).click()
  await page.getByRole('group', { name: 'Bewerking A', exact: true }).click()
  const contrastChecks = await page.evaluate(() => {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
        const channel = Number(value) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
    }
    return ['.sidebar .section-heading h2', '.sidebar-bottom', '.canvas-list button.active', '.toolbar-actions .primary', '.node-status', '.node-kind', '.node-footer', '.node-realization', '.availability', '.inspector-tabs .active', '.field select'].flatMap(selector => [...document.querySelectorAll(selector)].map(element => {
      const style = getComputedStyle(element)
      let ancestor: Element | null = element
      let background = 'rgba(0, 0, 0, 0)'
      while (ancestor && background === 'rgba(0, 0, 0, 0)') {
        background = getComputedStyle(ancestor).backgroundColor
        ancestor = ancestor.parentElement
      }
      const foregroundLight = luminance(style.color)
      const backgroundLight = luminance(background)
      return { selector, ratio: (Math.max(foregroundLight, backgroundLight) + 0.05) / (Math.min(foregroundLight, backgroundLight) + 0.05) }
    }))
  })

  for (const check of contrastChecks) expect(check.ratio, check.selector).toBeGreaterThanOrEqual(4.5)
  const overflowingNodes = await page.locator('.element-node').evaluateAll(nodes => nodes.filter(node => node.scrollHeight > node.clientHeight).length)
  expect(overflowingNodes).toBe(0)
  await page.screenshot({ path: '.tools\\desktop.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 760, height: 900 })
  await page.getByRole('button', { name: 'Alles in beeld', exact: true }).click()
  await page.screenshot({ path: '.tools\\smal.png', fullPage: true, animations: 'disabled' })
  for (const width of [760, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Eigenschappen', exact: true })).toBeVisible()
  }
})

test('pijlen naar resultaat, invoegen via toetsenbord, herstel en vier eigen eigenschappen', async ({ page }) => {
    await startCanvas(page)
    await page.getByRole('button', { name: 'Input toevoegen: Nieuw resultaat', exact: true }).click()
    await page.getByRole('button', { name: '+ Nieuw inputgegeven', exact: true }).click()
    await expect(page.locator('.element-node')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Transformatie invoegen', exact: true })).toBeVisible()
    await expect.poll(async () => page.locator('.react-flow__edge-path').evaluateAll(paths => paths.every(path => {
      const edge = path as SVGPathElement
      return edge.getPointAtLength(0).y > edge.getPointAtLength(edge.getTotalLength()).y
    }))).toBe(true)
    await expect(page.locator('.react-flow__edge')).toHaveAttribute('aria-label', 'Gegevensstroom van Nieuw datapunt naar Nieuw resultaat')
    await page.getByRole('button', { name: 'Transformatie invoegen', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Annuleren', exact: true }).click()
    await expect(page.locator('.element-node.transformation')).toHaveCount(0)
    await page.getByRole('button', { name: 'Transformatie invoegen', exact: true }).click()
    await page.getByRole('button', { name: /^API / }).click()
    await expect(page.locator('.element-node.transformation')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Transformatie invoegen', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /Ongedaan/ }).click()
    await expect(page.locator('.element-node.transformation')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Transformatie invoegen', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Opnieuw/ }).click()
    await expect(page.getByLabel('Type transformatie', { exact: true })).toHaveValue('api')
    await expect(page.getByRole('region', { name: 'Inputs en output' })).toContainText('Nieuw datapunt')
    await expect(page.getByRole('region', { name: 'Inputs en output' })).toContainText('Nieuw resultaat')
    await expect(page.getByLabel('Beschikbaarheid', { exact: true })).toHaveValue('undetermined')
    await page.getByLabel('Naam transformatie').fill('Transformatielabel')
    await page.getByLabel('API en operatie', { exact: true }).fill('Operatielabel')
    await page.getByLabel('Beschrijving API-uitvraag', { exact: true }).fill('Beschrijving van de gewenste afleiding')
    await page.getByLabel('Beschikbaarheid', { exact: true }).selectOption('toBuild')
    await page.getByLabel('EPIC-nummer', { exact: true }).fill('EPIC-verwijzing')
    await expect(page.locator('.transformation .availability')).toHaveText('Nog te bouwen')
    await page.getByLabel('Beschikbaarheid', { exact: true }).selectOption('available')
    await expect(page.getByLabel('EPIC-nummer', { exact: true })).toHaveCount(0)
    await expect(page.locator('.transformation .availability')).toHaveText('Beschikbaar')
    await page.getByLabel('Type transformatie', { exact: true }).selectOption('forcze')
    await expect(page.getByLabel('API en operatie', { exact: true })).toHaveCount(0)
    await page.getByLabel('Interactie in Forcze', { exact: true }).selectOption('both')
    await expect(page.getByLabel('Uitvraag of beoordelingsinstructie', { exact: true })).toHaveValue('Beschrijving van de gewenste afleiding')
    await page.getByLabel('Type transformatie', { exact: true }).selectOption('automation')
    await page.getByLabel('Voorwaarden voor de businessrule', { exact: true }).fill('Beschrijving van toepassingsvoorwaarden')
    await page.getByLabel('Type transformatie', { exact: true }).selectOption('agentic')
    await page.getByLabel('Kaders voor genAI', { exact: true }).fill('Beschrijving van de kaders')
    await page.getByLabel('Menselijke controle', { exact: true }).fill('Beschrijving van controle')
    await page.getByText('Logisch type en ontwerpzekerheid', { exact: true }).click()
    await page.getByLabel('Logisch type (optioneel)', { exact: true }).selectOption('interpretation')
    await page.getByLabel('Status transformatie', { exact: true }).selectOption('described')
    await expect(page.locator('.transformation .node-status')).toContainText('Beschreven')
    await expect(page.locator('.transformation .availability')).toHaveText('Beschikbaar')
    await saved(page)
    await page.reload()
    await page.getByRole('group', { name: 'Transformatielabel', exact: true }).click()
    await expect(page.getByLabel('Type transformatie', { exact: true })).toHaveValue('agentic')
    await expect(page.getByLabel('Kaders voor genAI', { exact: true })).toHaveValue('Beschrijving van de kaders')
    await expect(page.getByLabel('Menselijke controle', { exact: true })).toHaveValue('Beschrijving van controle')
    await page.getByLabel('Beschikbaarheid', { exact: true }).selectOption('toBuild')
    await expect(page.getByLabel('EPIC-nummer', { exact: true })).toHaveValue('EPIC-verwijzing')
    await page.getByLabel('Type transformatie', { exact: true }).selectOption('api')
    await expect(page.getByLabel('API en operatie', { exact: true })).toHaveValue('Operatielabel')
    await page.getByLabel('Type transformatie', { exact: true }).selectOption('forcze')
    await expect(page.getByLabel('Interactie in Forcze', { exact: true })).toHaveValue('both')
    await page.getByLabel('Type transformatie', { exact: true }).selectOption('automation')
    await expect(page.getByLabel('Voorwaarden voor de businessrule', { exact: true })).toHaveValue('Beschrijving van toepassingsvoorwaarden')
    await page.getByRole('button', { name: 'Selectie sluiten', exact: true }).click()
    await page.getByRole('group', { name: /^Gegevensstroom van/ }).first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Naam transformatie')).toHaveValue('Transformatielabel')
    await expect(page.locator('.element-node.transformation')).toHaveCount(1)
  })

test('bestaande input hergebruiken, ontbrekende transformatie signaleren en oudere bestanden migreren', async ({ page }) => {
    const workspace = fixture()
    const legacy = legacyCanvasSchema.parse({ ...workspace.canvases[0], schemaVersion: 1 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Maak je eerste canvas', exact: true })).toBeVisible()
    await page.locator('input[type=file]').setInputFiles({ name: 'ouder-ontwerp.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, canvas: legacy, catalog: workspace.catalog })) })
    await expect(page.locator('.transformation.realization-automation')).toHaveCount(2)
    await page.getByRole('group', { name: 'Bewerking A', exact: true }).click()
    await expect(page.getByLabel('Type transformatie', { exact: true })).toHaveValue('automation')
    await expect(page.getByLabel('Beschikbaarheid', { exact: true })).toHaveValue('undetermined')
    await page.getByRole('button', { name: 'Input toevoegen: Resultaat', exact: true }).click()
    await page.getByLabel('Bestaand inputgegeven', { exact: true }).selectOption({ label: 'Gedeeld label' })
    await page.getByRole('button', { name: 'Input koppelen', exact: true }).click()
    await expect(page.locator('.element-node')).toHaveCount(5)
    await expect(page.getByText(/Transformatie nog niet beschreven/)).toBeVisible()
    await page.getByRole('button', { name: 'Transformatie invoegen', exact: true }).click()
    await page.getByRole('button', { name: /^Forcze-uitvraag/ }).click()
    await expect(page.locator('.element-node')).toHaveCount(6)
    await expect(page.locator('.element-node strong').filter({ hasText: 'Gedeeld label' })).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'Inputs en output' })).toContainText('Gedeeld label')
    await expect(page.getByRole('region', { name: 'Inputs en output' })).toContainText('Resultaat')
})

test('getekende verbinding volgt input naar resultaat en blijft na herladen zichtbaar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startCanvas(page)
  await page.getByRole('button', { name: '+ Datapunt', exact: true }).click()
  const input = page.getByRole('group', { name: 'Nieuw datapunt', exact: true }).locator('.react-flow__handle.source')
  const output = page.getByRole('group', { name: 'Nieuw resultaat', exact: true }).locator('.react-flow__handle.target')
  await expect(input).toBeVisible()
  await expect(output).toBeVisible()
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false')
  await input.hover()
  const start = await input.boundingBox()
  await page.mouse.down()
  await page.mouse.move(start!.x + start!.width / 2, start!.y - 12, { steps: 3 })
  await expect(page.locator('.react-flow__connection-path')).toBeAttached()
  await output.hover()
  await page.mouse.up()
  await expect(page.locator('.react-flow__edge')).toHaveAttribute('aria-label', 'Gegevensstroom van Nieuw datapunt naar Nieuw resultaat')
  await saved(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Transformatie invoegen', exact: true })).toBeVisible()
  await page.getByRole('group', { name: 'Gegevensstroom van Nieuw datapunt naar Nieuw resultaat', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /^API / }).click()
  await expect(page.getByRole('region', { name: 'Inputs en output' })).toContainText('InputsNieuw datapuntOutputNieuw resultaat')
})

test('opslagfout is zichtbaar, werk blijft beschikbaar en opnieuw opslaan herstelt', async ({ page }) => {
  await startCanvas(page)
  await saved(page)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () { throw new DOMException('Opslag tijdelijk niet beschikbaar', 'QuotaExceededError') }
    window.addEventListener('restore-storage', () => { IDBObjectStore.prototype.put = put }, { once: true })
  })
  await page.getByLabel('Status datapunt').selectOption('assumed')
  await expect(page.getByRole('alert')).toContainText('Opslaan mislukt')
  await expect(page.locator('.local-status')).toContainText('Niet opgeslagen')
  await expect(page.getByLabel('Status datapunt')).toHaveValue('assumed')
  await expect(page.getByRole('button', { name: 'Exporteren', exact: true })).toBeEnabled()
  await page.evaluate(() => window.dispatchEvent(new Event('restore-storage')))
  await page.getByRole('button', { name: 'Opnieuw opslaan', exact: true }).click()
  await saved(page)
  await page.reload()
  await page.getByRole('group', { name: 'Nieuw resultaat', exact: true }).click()
  await expect(page.getByLabel('Status datapunt')).toHaveValue('assumed')
})
