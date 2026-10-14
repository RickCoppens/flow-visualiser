import { useCallback, useEffect, useRef, useState } from 'react'
import { addDependency, gapsBelow, insertTransformation, processMembers, removeElement, signalsFor } from './domain/graph'
import { createCanvas, createCatalogItem, createId, elements, isDataPoint, isGap, labelFor, uniqueTerm, type Canvas, type CatalogItem, type DataPoint, type Transformation } from './domain/model'
import { useWorkspace } from './state/useWorkspace'
import { exportCanvas, importCanvas } from './exchange/files'
import { Field } from './components/Field'
import { Graph, palette, statusLabels } from './components/Graph'
import { Icon } from './components/Icon'
import { TransformationChoices, TransformationEditor } from './components/TransformationEditor'

type Pane = 'properties' | 'catalog' | 'attention' | 'processes' | 'input' | 'transformation'
type AttentionCategory = 'uncertainties' | 'signals'

export default function App() {
  const store = useWorkspace()
  const { workspace, change } = store
  const [canvasId, setCanvasId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [pane, setPane] = useState<Pane | null>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [attentionCategory, setAttentionCategory] = useState<AttentionCategory>('uncertainties')
  const [processId, setProcessId] = useState('')
  const [catalogId, setCatalogId] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const [focus, setFocus] = useState({ id: '', revision: 0 })
  const [inputParentId, setInputParentId] = useState('')
  const [existingInputId, setExistingInputId] = useState('')
  const [transformationEdgeId, setTransformationEdgeId] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const canvas = workspace.canvases.find(item => item.id === canvasId) ?? workspace.canvases[0]
  const selected = canvas && elements(canvas).find(item => item.id === selectedId)
  const catalogItem = workspace.catalog.find(item => item.id === catalogId)
  const effectiveProcess = canvas?.processes.some(process => process.id === processId) ? processId : ''
  const updateCanvas = useCallback((update: (canvas: Canvas) => void) => {
    if (!canvas) return
    change(draft => {
      const current = draft.canvases.find(item => item.id === canvas.id)!
      update(current)
      current.updatedAt = new Date().toISOString()
    })
  }, [canvas, change])
  const openCanvas = (id: string) => {
    setCanvasId(id); setSelectedId(''); setProcessId(''); setCollapsed(new Set()); setPane(null)
  }
  const select = (id: string) => {
    setSelectedId(id)
    if (id) setPane('properties')
    else setPane(previous => previous === 'properties' ? null : previous)
  }
  const closePane = () => { setPane(null); setSelectedId('') }
  const focusElement = (id: string) => {
    setCollapsed(new Set()); select(id)
    setFocus(previous => ({ id, revision: previous.revision + 1 }))
  }
  const newCanvas = () => {
    const next = createCanvas()
    change(draft => { draft.canvases.push(next) })
    openCanvas(next.id)
  }
  const deleteCanvas = (id: string) => {
    if (!window.confirm('Dit canvas verwijderen? De globale catalogus blijft behouden. Je kunt dit ongedaan maken.')) return
    change(draft => { draft.canvases = draft.canvases.filter(item => item.id !== id) })
    if (canvas?.id === id) { setSelectedId(''); setProcessId(''); setCollapsed(new Set()); setPane(null) }
  }
  const addPoint = useCallback((deliverable = false, parentTransformationId = '') => {
    if (!canvas) return
    const pointId = createId()
    change(draft => {
      const current = draft.canvases.find(item => item.id === canvas.id)!
      const item = createCatalogItem(draft.catalog, deliverable ? 'Nieuw resultaat' : 'Nieuw datapunt')
      draft.catalog.push(item)
      let processes: string[] = []
      if (deliverable) {
        let process = current.processes.find(item => item.id === effectiveProcess) ?? current.processes[0]
        if (!process) {
          process = { id: createId(), name: 'Nieuw proces', description: '' }
          current.processes.push(process)
        }
        processes = [process.id]
      }
      current.dataPoints.push({ id: pointId, catalogItemId: item.id, status: 'missing', deliverableProcessIds: processes, notes: '' })
      if (parentTransformationId) addDependency(current, { id: createId(), source: parentTransformationId, target: pointId })
      current.updatedAt = new Date().toISOString()
    })
    setCollapsed(new Set()); select(pointId)
  }, [canvas, change, effectiveProcess])
  function addTransformation(realization: Transformation['realization']) {
    try {
      const draft = structuredClone(store.readWorkspace())
      const current = draft.canvases.find(item => item.id === canvas?.id)
      if (!current) throw new Error('Dit canvas bestaat niet meer. Kies opnieuw een canvas.')
      const id = insertTransformation(current, transformationEdgeId, realization)
      current.updatedAt = new Date().toISOString()
      store.replace(draft)
      setCollapsed(new Set()); select(id); setFailure('')
    } catch (cause) { setFailure(cause instanceof Error ? cause.message : String(cause)) }
  }
  function openEdge(edgeId: string) {
    const edge = canvas?.dependencies.find(item => item.id === edgeId)
    if (!edge) { setFailure('Deze verbinding bestaat niet meer. Kies opnieuw een pijl.'); return }
    const transformation = canvas!.transformations.find(item => item.id === edge.source || item.id === edge.target)
    if (transformation) select(transformation.id)
    else { setTransformationEdgeId(edgeId); setPane('transformation') }
  }
  function chooseInput(id: string) {
    setInputParentId(id); setExistingInputId(''); setPane('input')
  }
  function updatePoint(patch: Partial<DataPoint>) {
    updateCanvas(current => { const point = current.dataPoints.find(item => item.id === selectedId); if (point) Object.assign(point, patch) })
  }
  function updateTransformation(patch: Partial<Transformation>) {
    updateCanvas(current => { const item = current.transformations.find(item => item.id === selectedId); if (item) Object.assign(item, patch) })
  }
  function updateCatalog(id: string, patch: Partial<CatalogItem>) {
    change(draft => {
      const item = draft.catalog.find(item => item.id === id)!
      if (patch.term !== undefined) patch = { ...patch, term: uniqueTerm(draft.catalog.filter(other => other.id !== id), patch.term) }
      Object.assign(item, patch)
    })
  }
  function newCatalogItem() {
    const item = createCatalogItem(workspace.catalog)
    change(draft => { draft.catalog.push(item) })
    setCatalogId(item.id); setPane('catalog')
  }
  function download() {
    if (!canvas) return
    const blob = new Blob([exportCanvas(canvas, workspace.catalog)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${canvas.name.replace(/[<>:"/\\|?*]/g, '_') || 'canvas'}.json`; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Canvas met catalogussnapshot geëxporteerd. Bewaar dit bestand als back-up.')
  }
  async function upload(file: File) {
    try {
      const text = await file.text()
      const imported = importCanvas(text, store.readWorkspace())
      store.replace(imported.workspace)
      openCanvas(imported.canvasId)
      setFailure('')
      setNotice(imported.conflicts.length ? `Geïmporteerd. Catalogusconflicten: ${imported.conflicts.join(' ')}` : 'Canvas geïmporteerd als nieuwe save file.')
    } catch (cause) { setFailure(cause instanceof Error ? cause.message : String(cause)) }
  }
  if (!store.ready) return <main className="loading">{store.error ? <p role="alert">{store.error}</p> : <p>Werkruimte laden…</p>}</main>
  const allElements = canvas ? elements(canvas) : []
  const signals = canvas ? signalsFor(canvas) : []
  const allowedIds = canvas && effectiveProcess ? processMembers(canvas, effectiveProcess) : new Set(allElements.map(element => element.id))
  const uncertainties = allElements.filter(element => allowedIds.has(element.id) && isGap(element))
  const structuralSignals = signals.filter(signal => allowedIds.has(signal.elementId))
  const deliverables = canvas?.dataPoints.filter(point => point.deliverableProcessIds.length && (!effectiveProcess || point.deliverableProcessIds.includes(effectiveProcess))) ?? []
  const coveredUncertainties = new Set(deliverables.flatMap(point => gapsBelow(canvas!, point.id, true).map(element => element.id)))
  const unassignedUncertainties = uncertainties.filter(element => !coveredUncertainties.has(element.id))
  const inspectorOpen = pane !== null && (pane !== 'properties' || !!selected)
  const selectedItem = selected && isDataPoint(selected) ? workspace.catalog.find(item => item.id === selected.catalogItemId) : undefined
  return <div className="app">
    <header className="app-header">
      <button className="navigation-toggle" aria-label="Navigatie" title="Navigatie" aria-expanded={navigationOpen} aria-controls="navigation" onClick={() => setNavigationOpen(open => !open)}><Icon name="menu" /></button>
      {canvas && <CanvasHeading key={canvas.id} canvas={canvas} onRename={name => updateCanvas(current => { current.name = name })} />}
      {store.saveStatus === 'Opslaan…' && <span className="save-progress" role="status">Opslaan…</span>}
      <div className="header-actions">
        {canvas && <>
          <button className="primary" onClick={() => addPoint(true)}>+ Deliverable</button>
          <AttentionMenu uncertainties={uncertainties.length} signals={structuralSignals.length} onChoose={category => { setAttentionCategory(category); setPane('attention') }} />
          <span className="toolbar-divider" />
        </>}
        <button onClick={store.undo} disabled={!store.canUndo} aria-label="Ongedaan maken" title="Ongedaan maken"><Icon name="undo" /><span>Ongedaan</span></button>
        <button onClick={store.redo} disabled={!store.canRedo} aria-label="Opnieuw uitvoeren" title="Opnieuw uitvoeren"><Icon name="redo" /><span>Opnieuw</span></button>
        <span className="toolbar-divider" />
        <button onClick={() => fileInput.current?.click()}><Icon name="import" />Importeren</button>
        <button className="export-button" onClick={download} disabled={!canvas}><Icon name="export" />Exporteren</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={event => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }} />
      </div>
    </header>
    {store.error && <div className="message error" role="alert">{store.error} <button onClick={store.retry}>Opnieuw opslaan</button></div>}
    {failure && <div className="message error" role="alert">{failure}<button aria-label="Foutmelding sluiten" onClick={() => setFailure('')}>Sluiten</button></div>}
    {notice && <div className="message" role="status">{notice}<button aria-label="Melding sluiten" onClick={() => setNotice('')}>Sluiten</button></div>}
    <div className={`workspace${navigationOpen ? ' navigation-open' : ''}${inspectorOpen ? ' inspector-open' : ''}`} id="werkruimte">
      {navigationOpen && <aside className="sidebar" aria-label="Navigatie" id="navigation">
        <div className="section-heading"><h2>Canvassen</h2><button className="icon-button" onClick={newCanvas} aria-label="Nieuw canvas">+</button></div>
        <nav className="canvas-list">
          {workspace.canvases.map(item => <div className="canvas-entry" key={item.id}>
            <button className={canvas?.id === item.id ? 'active' : ''} aria-current={canvas?.id === item.id ? 'page' : undefined} onClick={() => openCanvas(item.id)}><Icon name="canvas" /><span>{item.name || 'Naamloos canvas'}</span></button>
            <button className="canvas-delete" aria-label={`Canvas verwijderen: ${item.name || 'Naamloos canvas'}`} title="Canvas verwijderen" onClick={() => deleteCanvas(item.id)}><Icon name="delete" /></button>
          </div>)}
          {!workspace.canvases.length && <p className="muted small">Nog geen canvassen.</p>}
        </nav>
        <button className={`sidebar-action ${pane === 'catalog' ? 'active' : ''}`} onClick={() => { setPane('catalog'); setCatalogId('') }}><Icon name="catalog" />Data catalogus <span>{workspace.catalog.length}</span></button>
        <div className="section-heading process-heading"><h2>Processen</h2>{canvas && <button className="icon-button" aria-label="Nieuw proces" onClick={() => {
          updateCanvas(current => current.processes.push({ id: createId(), name: 'Nieuw proces', description: '' })); setPane('processes')
        }}>+</button>}</div>
        {canvas && <div className="process-list"><button className={!effectiveProcess ? 'active' : ''} aria-pressed={!effectiveProcess} onClick={() => setProcessId('')}>Alle processen</button>
          {canvas.processes.map((process, index) => <button key={process.id} className={effectiveProcess === process.id ? 'active' : ''} aria-pressed={effectiveProcess === process.id} onClick={() => { setProcessId(process.id); setCollapsed(new Set()) }}><span className="process-dot" style={{ background: palette[index % palette.length] }} /><span className="process-name">{process.name || 'Naamloos proces'}</span><small>{processMembers(canvas, process.id).size}</small></button>)}
          <button className="text-button" onClick={() => setPane('processes')}>Processen beheren</button>
        </div>}
      </aside>}
      <main className="canvas-area" aria-label="Graafwerkruimte">
        {!canvas ? <div className="empty-state"><h1>Geen canvas geopend</h1><button className="primary" onClick={newCanvas}>Nieuw canvas</button><button onClick={() => fileInput.current?.click()}>Canvas importeren</button></div> :
          !allElements.length ? <div className="empty-state"><h2>Canvas is leeg</h2><button className="primary" onClick={() => addPoint(true)}>Deliverable toevoegen</button></div> :
          <div className="graph-wrap"><Graph canvas={canvas} catalog={workspace.catalog} processId={effectiveProcess} selectedId={selectedId} collapsed={collapsed}
            onToggle={id => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })}
            onSelect={select} onConnect={(source, target) => updateCanvas(current => addDependency(current, { id: createId(), source, target }))}
            onAddInput={chooseInput} onOpenEdge={openEdge}
            focusId={focus.id} focusRevision={focus.revision} />
          </div>}
      </main>
      {inspectorOpen && <aside className="inspector" aria-label="Details">
        <div className="inspector-tabs" role="group" aria-label="Detailweergave">
          {selected && <button className={pane === 'properties' ? 'active' : ''} aria-pressed={pane === 'properties'} onClick={() => setPane('properties')}>Eigenschappen</button>}
          {canvas && <button className={pane === 'attention' ? 'active' : ''} aria-pressed={pane === 'attention'} onClick={() => setPane('attention')}>Aandachtspunten</button>}
          <button className={pane === 'catalog' ? 'active' : ''} aria-pressed={pane === 'catalog'} onClick={() => setPane('catalog')}>Catalogus</button>
          <button className="inspector-close" aria-label="Paneel sluiten" title="Paneel sluiten" onClick={closePane}>×</button>
        </div>
        <div className="inspector-content">
          {pane === 'input' && canvas && <>
            <h2>Input toevoegen</h2>
            {canvas.dataPoints.some(point => point.id === inputParentId) ? <>
              <p className="small">Input voor {labelFor(canvas.dataPoints.find(point => point.id === inputParentId)!, workspace.catalog)}</p>
              <button className="primary full" onClick={() => addPoint(false, inputParentId)}>+ Nieuw inputgegeven</button>
              <label className="field"><span>Bestaand inputgegeven</span><select aria-label="Bestaand inputgegeven" value={existingInputId} onChange={event => setExistingInputId(event.target.value)}><option value="">Kies een gegeven</option>{canvas.dataPoints.map(point => <option key={point.id} value={point.id}>{labelFor(point, workspace.catalog)}{point.id === inputParentId ? ' (zichzelf)' : ''}</option>)}</select></label>
              <button className="full" disabled={!canvas.dataPoints.some(point => point.id === existingInputId)} onClick={() => {
                updateCanvas(current => addDependency(current, { id: createId(), source: inputParentId, target: existingInputId }))
                setCollapsed(new Set()); select(inputParentId)
              }}>Input koppelen</button>
            </> : <p role="alert">Dit gegeven bestaat niet meer. Kies opnieuw een gegevenskaart.</p>}
            <button className="full cancel-action" onClick={() => setPane(selected ? 'properties' : null)}>Annuleren</button>
          </>}
          {pane === 'transformation' && canvas && <>
            <h2>Transformatie invoegen</h2>
            <TransformationChoices onChoose={addTransformation} />
            <button className="full cancel-action" onClick={() => setPane(selected ? 'properties' : null)}>Annuleren</button>
          </>}
          {pane === 'properties' && selected && <>
            <div className="section-heading"><h2>{isDataPoint(selected) ? 'Datapunt' : 'Transformatie'}</h2><button onClick={() => setSelectedId('')} aria-label="Selectie sluiten">×</button></div>
            {isDataPoint(selected) ? <>
              <label className="field"><span>Catalogusitem</span><select value={selected.catalogItemId} onChange={event => updatePoint({ catalogItemId: event.target.value })}>{workspace.catalog.map(item => <option key={item.id} value={item.id}>{item.term}</option>)}</select></label>
              <div className="inline-actions"><button onClick={() => { const item = createCatalogItem(workspace.catalog); change(draft => { draft.catalog.push(item); const point = draft.canvases.find(item => item.id === canvas!.id)!.dataPoints.find(item => item.id === selectedId)!; point.catalogItemId = item.id }); setCatalogId(item.id); setPane('catalog') }}>Nieuw catalogusitem</button><button onClick={() => { setCatalogId(selected.catalogItemId); setPane('catalog') }}>Item bewerken</button></div>
              {selectedItem && <div className="definition"><strong>{selectedItem.term}</strong><p>{selectedItem.definition || 'Nog geen definitie.'}</p><small>Kwaliteitscriteria: {selectedItem.qualityCriteria || 'Nog niet beschreven.'}</small></div>}
              <label className="field"><span>Status datapunt</span><select value={selected.status} onChange={event => updatePoint({ status: event.target.value as DataPoint['status'] })}>{['missing', 'assumed', 'known'].map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
              <fieldset><legend>Deliverable voor proces</legend>{canvas!.processes.length ? canvas!.processes.map(process => <label className="checkbox" key={process.id}><input type="checkbox" checked={selected.deliverableProcessIds.includes(process.id)} onChange={event => updatePoint({ deliverableProcessIds: event.target.checked ? [...selected.deliverableProcessIds, process.id] : selected.deliverableProcessIds.filter(id => id !== process.id) })} />{process.name || 'Naamloos proces'}</label>) : <button onClick={() => setPane('processes')}>Maak eerst een proces</button>}</fieldset>
              <Field label="Notities datapunt" multiline value={selected.notes} onChange={notes => updatePoint({ notes })} />
            </> : <>
              <TransformationEditor key={selected.id} transformation={selected} canvas={canvas!} catalog={workspace.catalog} onChange={updateTransformation} />
              <button className="primary full" onClick={() => addPoint(false, selected.id)}>+ Benodigd datapunt</button>
            </>}
            <Connections canvas={canvas!} selectedId={selectedId} catalog={workspace.catalog} onChange={updateCanvas} onSelect={select} />
            {!!signals.filter(signal => signal.elementId === selectedId).length && <div className="signal-block"><h3>Signalen</h3>{signals.filter(signal => signal.elementId === selectedId).map((signal, index) => <p key={index}>! {signal.message}</p>)}</div>}
            <button className="danger full" onClick={() => { if (window.confirm('Dit element en zijn verbindingen verwijderen? Onderliggende elementen blijven behouden.')) { updateCanvas(current => removeElement(current, selectedId)); setSelectedId('') } }}>Element verwijderen</button>
          </>}
          {pane === 'catalog' && <>
            <div className="section-heading"><h2>Data catalogus</h2><button aria-label="Nieuw catalogusitem" onClick={newCatalogItem}>+</button></div>
            <label className="field"><span>Zoeken in catalogus</span><input value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Term of synoniem" /></label>
            <div className="catalog-list">{workspace.catalog.filter(item => `${item.term} ${item.synonyms.join(' ')}`.toLocaleLowerCase('nl').includes(catalogSearch.toLocaleLowerCase('nl'))).map(item => <button className={item.id === catalogId ? 'active' : ''} key={item.id} onClick={() => setCatalogId(item.id)}>{item.term}</button>)}</div>
            {catalogItem ? <div key={catalogItem.id} className="catalog-editor">
              <Field label="Term" value={catalogItem.term} preserveDraft onChange={term => updateCatalog(catalogItem.id, { term })} hint="Uniek label; een dubbele term krijgt een volgnummer. De aangepaste term verschijnt na verlaten van dit veld." />
              <Field label="Definitie" value={catalogItem.definition} multiline placeholder="Beschrijf wat dit gegeven betekent" onChange={definition => updateCatalog(catalogItem.id, { definition })} />
              <Field label="Synoniemen" value={catalogItem.synonyms.join('\n')} multiline onChange={text => updateCatalog(catalogItem.id, { synonyms: text.split('\n') })} hint="Eén label per regel." />
              <Field label="Afgekeurde termen" value={catalogItem.deprecatedTerms.join('\n')} multiline onChange={text => updateCatalog(catalogItem.id, { deprecatedTerms: text.split('\n') })} />
              <Field label="Eigenaar (functielabel, geen persoonsnaam)" value={catalogItem.owner} onChange={owner => updateCatalog(catalogItem.id, { owner })} />
              <Field label="Kwaliteitscriteria" value={catalogItem.qualityCriteria} multiline placeholder="Beschrijf waaraan het gegeven moet voldoen" onChange={qualityCriteria => updateCatalog(catalogItem.id, { qualityCriteria })} />
              <label className="field"><span>Kardinaliteit</span><select value={catalogItem.cardinality} onChange={event => updateCatalog(catalogItem.id, { cardinality: event.target.value as CatalogItem['cardinality'] })}><option value="single">Enkelvoudig</option><option value="list">Lijst</option></select></label>
              <p className="muted small">Gebruikt in {workspace.canvases.filter(item => item.dataPoints.some(point => point.catalogItemId === catalogItem.id)).length} canvassen.</p>
              <label className="field"><span>Vervangen door</span><select id="catalog-replacement" defaultValue=""><option value="">Niet vervangen</option>{workspace.catalog.filter(item => item.id !== catalogItem.id).map(item => <option value={item.id} key={item.id}>{item.term}</option>)}</select></label>
              <button className="danger full" onClick={() => {
                const replacement = (document.getElementById('catalog-replacement') as HTMLSelectElement).value
                const used = workspace.canvases.some(item => item.dataPoints.some(point => point.catalogItemId === catalogItem.id))
                if (used && !replacement) { setFailure('Dit catalogusitem is in gebruik en blijft behouden. Kies eerst een vervangend item.'); return }
                if (!window.confirm('Catalogusitem verwijderen? Gekoppelde datapunten worden alleen bij een gekozen vervanging omgekoppeld.')) return
                change(draft => {
                  for (const current of draft.canvases) for (const point of current.dataPoints) if (point.catalogItemId === catalogItem.id) point.catalogItemId = replacement
                  draft.catalog = draft.catalog.filter(item => item.id !== catalogItem.id)
                }); setCatalogId('')
              }}>Catalogusitem verwijderen</button>
            </div> : <p className="muted">Geen catalogusitem geselecteerd.</p>}
          </>}
          {pane === 'processes' && <>
            <h2>Processen beheren</h2>
            {canvas?.processes.map(process => <section className="process-editor" key={process.id}>
              <Field label="Procesnaam" value={process.name} onChange={name => updateCanvas(current => { current.processes.find(item => item.id === process.id)!.name = name })} />
              <Field label="Procesbeschrijving" value={process.description} multiline placeholder="Beschrijf het gewenste resultaat en de afbakening" onChange={description => updateCanvas(current => { current.processes.find(item => item.id === process.id)!.description = description })} />
              <p className="small">{processMembers(canvas, process.id).size} bereikbare elementen</p>
              <button className="danger" onClick={() => { if (window.confirm('Proces verwijderen? Datapunten en transformaties blijven behouden.')) updateCanvas(current => { current.processes = current.processes.filter(item => item.id !== process.id); current.dataPoints.forEach(point => { point.deliverableProcessIds = point.deliverableProcessIds.filter(id => id !== process.id) }) }) }}>Proces verwijderen</button>
            </section>)}
            {canvas && <button className="full" onClick={() => updateCanvas(current => { current.processes.push({ id: createId(), name: 'Nieuw proces', description: '' }) })}>+ Proces toevoegen</button>}
          </>}
          {pane === 'attention' && <>
            <h2>Aandachtspunten</h2>
            <div className="attention-tabs" role="group" aria-label="Soort aandachtspunt">
              <button className={attentionCategory === 'uncertainties' ? 'active' : ''} aria-pressed={attentionCategory === 'uncertainties'} onClick={() => setAttentionCategory('uncertainties')}>Onzekerheden ({uncertainties.length})</button>
              <button className={attentionCategory === 'signals' ? 'active' : ''} aria-pressed={attentionCategory === 'signals'} onClick={() => setAttentionCategory('signals')}>Structuursignalen ({structuralSignals.length})</button>
            </div>
            {attentionCategory === 'uncertainties' && <>
            {deliverables.map(point => {
              const gaps = gapsBelow(canvas!, point.id, true)
              return <section className="gap-section" key={point.id}><h3>{labelFor(point, workspace.catalog)}</h3><p className="small">{gaps.length} unieke onzekerheden, inclusief de deliverable</p>{gaps.map(element => <button className="result-link" key={element.id} onClick={() => focusElement(element.id)}><span className={`status-${element.status}`}>! {statusLabels[element.status]}</span><strong>{labelFor(element, workspace.catalog)}</strong></button>)}{!gaps.length && <p>Geen onzekerheden in deze beslisboom.</p>}</section>
            })}
            {!!unassignedUncertainties.length && <section className="gap-section"><h3>Buiten de deliverables</h3>{unassignedUncertainties.map(element => <button className="result-link" key={element.id} onClick={() => focusElement(element.id)}><span className={`status-${element.status}`}>! {statusLabels[element.status]}</span><strong>{labelFor(element, workspace.catalog)}</strong></button>)}</section>}
            {!uncertainties.length && <p className="muted">Geen onzekerheden.</p>}
            </>}
            {attentionCategory === 'signals' && <>
              {structuralSignals.map((signal, index) => <button className="result-link" key={`${signal.elementId}-${index}`} onClick={() => focusElement(signal.elementId)}><strong>{allElements.find(element => element.id === signal.elementId) ? labelFor(allElements.find(element => element.id === signal.elementId)!, workspace.catalog) : 'Element'}</strong><span>{signal.message}</span></button>)}
              {!structuralSignals.length && <p className="muted">Geen structuursignalen.</p>}
            </>}
          </>}
        </div>
      </aside>}
    </div>
  </div>
}

function CanvasHeading({ canvas, onRename }: { canvas: Canvas; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(canvas.name)
  const cancelled = useRef(false)
  return <div className="canvas-heading">
    <div className="canvas-title">
      {editing ? <input aria-label="Canvasnaam" value={draft} autoFocus onFocus={event => event.target.select()} onChange={event => setDraft(event.target.value)}
        onBlur={() => { if (!cancelled.current) onRename(draft); setEditing(false) }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
          if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; setEditing(false) }
        }} /> : <><h1 title={canvas.name || 'Naamloos canvas'}>{canvas.name || 'Naamloos canvas'}</h1><button aria-label="Canvasnaam wijzigen" title="Canvasnaam wijzigen" onClick={() => { setDraft(canvas.name); cancelled.current = false; setEditing(true) }}><Icon name="edit" /></button></>}
    </div>
    <span className="muted small">{`${canvas.dataPoints.length} datapunten · ${canvas.transformations.length} transformaties`}</span>
  </div>
}

function AttentionMenu({ uncertainties, signals, onChoose }: { uncertainties: number; signals: number; onChoose: (category: AttentionCategory) => void }) {
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute('open')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.removeAttribute('open')
        menu.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [])
  const choose = (category: AttentionCategory) => { menu.current?.removeAttribute('open'); onChoose(category) }
  return <details className="attention-menu" ref={menu}>
    <summary>Aandachtspunten <span className="count">{uncertainties + signals}</span><Icon name="chevron" /></summary>
    <div className="attention-dropdown">
      <button onClick={() => choose('uncertainties')}>Onzekerheden <span className="count">{uncertainties}</span></button>
      <button onClick={() => choose('signals')}>Structuursignalen <span className="count">{signals}</span></button>
    </div>
  </details>
}

function Connections({ canvas, selectedId, catalog, onChange, onSelect }: {
  canvas: Canvas; selectedId: string; catalog: CatalogItem[]; onChange: (update: (canvas: Canvas) => void) => void; onSelect: (id: string) => void
}) {
  const [targetId, setTargetId] = useState('')
  const [direction, setDirection] = useState('outgoing')
  const all = elements(canvas)
  const links = canvas.dependencies.filter(edge => edge.source === selectedId || edge.target === selectedId)
  return <section className="connections"><h3>Afhankelijkheden</h3>
    {links.map(edge => {
      const other = all.find(item => item.id === (edge.source === selectedId ? edge.target : edge.source))!
      return <div className="connection" key={edge.id}><button onClick={() => onSelect(other.id)}>{edge.source === selectedId ? 'Nodig: ' : 'Nodig voor: '}{labelFor(other, catalog)}</button><button aria-label={`Verbinding verwijderen: ${labelFor(other, catalog)}`} onClick={() => onChange(current => { current.dependencies = current.dependencies.filter(item => item.id !== edge.id) })}>×</button></div>
    })}
    <label className="field"><span>Richting verbinding</span><select value={direction} onChange={event => setDirection(event.target.value)}><option value="outgoing">Geselecteerd element heeft nodig</option><option value="incoming">Geselecteerd element is nodig voor</option></select></label>
    <label className="field"><span>Bestaand element koppelen</span><select value={all.some(item => item.id === targetId) ? targetId : ''} onChange={event => setTargetId(event.target.value)}><option value="">Kies een element</option>{all.map(item => <option value={item.id} key={item.id}>{labelFor(item, catalog)}{item.id === selectedId ? ' (zichzelf)' : ''}</option>)}</select></label>
    <button className="full" disabled={!targetId || !all.some(item => item.id === targetId)} onClick={() => {
      onChange(current => addDependency(current, { id: createId(), source: direction === 'outgoing' ? selectedId : targetId, target: direction === 'outgoing' ? targetId : selectedId }))
      setTargetId('')
    }}>Verbinding toevoegen</button>
  </section>
}
