import { useCallback, useEffect, useRef, useState } from 'react'
import { addDependency, gapsBelow, insertTransformation, processMembers, removeElement, signalsFor } from './domain/graph'
import { createCanvas, createCatalogItem, createId, createTransformation, elements, isDataPoint, labelFor, uniqueTerm, type Canvas, type CatalogItem, type DataPoint, type Transformation } from './domain/model'
import { useWorkspace } from './state/useWorkspace'
import { exportCanvas, importCanvas } from './exchange/files'
import { Field } from './components/Field'
import { Graph, palette, statusLabels } from './components/Graph'
import { Icon } from './components/Icon'
import { TransformationChoices, TransformationEditor } from './components/TransformationEditor'

type Pane = 'properties' | 'catalog' | 'gaps' | 'processes' | 'input' | 'transformation'

export default function App() {
  const store = useWorkspace()
  const { workspace, change, undo, redo } = store
  const [canvasId, setCanvasId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [pane, setPane] = useState<Pane>('properties')
  const [processId, setProcessId] = useState('')
  const [catalogId, setCatalogId] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const [focus, setFocus] = useState({ id: '', revision: 0 })
  const [inputParentId, setInputParentId] = useState('')
  const [existingInputId, setExistingInputId] = useState('')
  const [transformationTarget, setTransformationTarget] = useState({ edgeId: '', outputId: '' })
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
    setCanvasId(id); setSelectedId(''); setProcessId(''); setCollapsed(new Set()); setPane('properties')
  }
  const select = (id: string) => { setSelectedId(id); setPane('properties') }
  const focusElement = (id: string) => {
    setProcessId(''); setCollapsed(new Set()); setSelectedId(id)
    setFocus(previous => ({ id, revision: previous.revision + 1 }))
  }
  const newCanvas = () => {
    const next = createCanvas()
    change(draft => { draft.canvases.push(next) })
    openCanvas(next.id)
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
  const chooseTransformation = useCallback((outputId = '') => {
    setTransformationTarget({ edgeId: '', outputId }); setPane('transformation')
  }, [])
  function addTransformation(realization: Transformation['realization']) {
    try {
      const draft = structuredClone(store.readWorkspace())
      const current = draft.canvases.find(item => item.id === canvas?.id)
      if (!current) throw new Error('Dit canvas bestaat niet meer. Kies opnieuw een canvas.')
      const next = createTransformation(realization)
      let id = next.id
      if (transformationTarget.edgeId) id = insertTransformation(current, transformationTarget.edgeId, realization)
      else {
        if (transformationTarget.outputId && !current.dataPoints.some(point => point.id === transformationTarget.outputId)) throw new Error('Het gekozen resultaat bestaat niet meer. Kies opnieuw een gegevenskaart.')
        current.transformations.push(next)
        if (transformationTarget.outputId) addDependency(current, { id: createId(), source: transformationTarget.outputId, target: id })
      }
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
    else { setTransformationTarget({ edgeId, outputId: '' }); setPane('transformation') }
  }
  function chooseInput(id: string) {
    setInputParentId(id); setExistingInputId(''); setPane('input')
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); redo()
      } else if (event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault(); addPoint(!selected, selected && !isDataPoint(selected) ? selected.id : '')
      } else if (event.altKey && event.key.toLowerCase() === 't') {
        event.preventDefault(); chooseTransformation(selected && isDataPoint(selected) ? selected.id : '')
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [undo, redo, addPoint, chooseTransformation, selected])
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
  if (!store.ready) return <main className="loading"><h1>Flow Visualiser</h1>{store.error ? <p role="alert">{store.error}</p> : <p>Lokale werkruimte openen…</p>}</main>
  const allElements = canvas ? elements(canvas) : []
  const signals = canvas ? signalsFor(canvas) : []
  const selectedItem = selected && isDataPoint(selected) ? workspace.catalog.find(item => item.id === selected.catalogItemId) : undefined
  return <div className="app">
    <header className="app-header">
      <a className="brand" href="#werkruimte"><span className="brand-mark"><Icon name="flow" /></span><span>Flow <b>Visualiser</b></span></a>
      <span className="local-status"><span aria-hidden>●</span> {store.saveStatus}</span>
      <div className="header-actions">
        <button onClick={store.undo} disabled={!store.canUndo} aria-label="Ongedaan maken" title="Ongedaan maken (Ctrl+Z)"><Icon name="undo" /><span>Ongedaan</span></button>
        <button onClick={store.redo} disabled={!store.canRedo} aria-label="Opnieuw uitvoeren" title="Opnieuw (Ctrl+Shift+Z)"><Icon name="redo" /><span>Opnieuw</span></button>
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
    <div className="workspace" id="werkruimte">
      <aside className="sidebar" aria-label="Navigatie">
        <div className="section-heading"><h2>Canvassen</h2><button className="icon-button" onClick={newCanvas} aria-label="Nieuw canvas">+</button></div>
        <p className="muted small">Je lokale save files</p>
        <nav className="canvas-list">
          {workspace.canvases.map(item => <button key={item.id} className={canvas?.id === item.id ? 'active' : ''} aria-current={canvas?.id === item.id ? 'page' : undefined} onClick={() => openCanvas(item.id)}><Icon name="canvas" /><span>{item.name || 'Naamloos canvas'}</span></button>)}
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
        <div className="sidebar-bottom"><strong>Begin bij het resultaat.</strong><p>Wat moet je opleveren, en wat heb je daarvoor nodig?</p><details><summary>Sneltoetsen</summary><p>Alt+D: datapunt<br />Alt+T: transformatie<br />Ctrl+Z: ongedaan<br />Ctrl+Shift+Z: opnieuw</p></details></div>
      </aside>
      <main className="canvas-area" aria-label="Graafwerkruimte">
        <div className="canvas-toolbar"><div><h1>{canvas?.name || 'Je eerste beslisboom'}</h1><span className="muted small">{canvas ? `${canvas.dataPoints.length} datapunten · ${canvas.transformations.length} transformaties` : 'Van gewenst resultaat naar benodigde gegevens'}</span></div>
          {canvas && <div className="toolbar-actions"><button className="primary" onClick={() => addPoint(true)}>+ Deliverable</button><button onClick={() => addPoint()}>+ Datapunt</button><button onClick={() => chooseTransformation()}>+ Transformatie</button><button className={`signals-button ${pane === 'gaps' ? 'active' : ''}`} onClick={() => setPane('gaps')}>Gaten & signalen <span className="count">{signals.length}</span></button></div>}
        </div>
        {!canvas ? <div className="empty-state"><div className="empty-diagram" aria-hidden><i /><span /><i /><span /><i /></div><h2>Breng in beeld wat nodig is.</h2><p>Start met een canvas. Voeg een deliverable toe en werk terug naar de gegevens en logica die het resultaat mogelijk maken.</p><button className="primary" onClick={newCanvas}>Maak je eerste canvas</button><button onClick={() => fileInput.current?.click()}>Of importeer een canvas</button></div> :
          !allElements.length ? <div className="empty-state"><div className="empty-diagram" aria-hidden><i /><span /><i /></div><h2>Welk resultaat wil je opleveren?</h2><p>Een deliverable is een datapunt dat bij een proces hoort. Je bouwt de afhankelijkheden eronder op.</p><button className="primary" onClick={() => addPoint(true)}>Voeg je eerste deliverable toe</button></div> :
          <div className="graph-wrap"><Graph canvas={canvas} catalog={workspace.catalog} processId={effectiveProcess} selectedId={selectedId} collapsed={collapsed}
            onToggle={id => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })}
            onSelect={select} onConnect={(source, target) => updateCanvas(current => addDependency(current, { id: createId(), source, target }))}
            onAddInput={chooseInput} onOpenEdge={openEdge}
            focusId={focus.id} focusRevision={focus.revision} />
            <div className="graph-caption">Gegevensstroom: input → transformatie → resultaat ↑</div>
          </div>}
      </main>
      <aside className="inspector" aria-label="Details">
        <div className="inspector-tabs" role="group" aria-label="Detailweergave">
          <button className={pane === 'properties' ? 'active' : ''} aria-pressed={pane === 'properties'} onClick={() => setPane('properties')}>Eigenschappen</button>
          <button className={pane === 'gaps' ? 'active' : ''} aria-pressed={pane === 'gaps'} onClick={() => setPane('gaps')}>Gaten</button>
          <button className={pane === 'catalog' ? 'active' : ''} aria-pressed={pane === 'catalog'} onClick={() => setPane('catalog')}>Catalogus</button>
        </div>
        <div className="inspector-content">
          {pane === 'input' && canvas && <>
            <h2>Input toevoegen</h2>
            {canvas.dataPoints.some(point => point.id === inputParentId) ? <>
              <p className="muted small">Wat is nodig voor {labelFor(canvas.dataPoints.find(point => point.id === inputParentId)!, workspace.catalog)}? Voeg een gegeven toe en beschrijf daarna de transformatie op de pijl.</p>
              <button className="primary full" onClick={() => addPoint(false, inputParentId)}>+ Nieuw inputgegeven</button>
              <label className="field"><span>Bestaand inputgegeven</span><select aria-label="Bestaand inputgegeven" value={existingInputId} onChange={event => setExistingInputId(event.target.value)}><option value="">Kies een gegeven</option>{canvas.dataPoints.map(point => <option key={point.id} value={point.id}>{labelFor(point, workspace.catalog)}{point.id === inputParentId ? ' (zichzelf)' : ''}</option>)}</select></label>
              <button className="full" disabled={!canvas.dataPoints.some(point => point.id === existingInputId)} onClick={() => {
                updateCanvas(current => addDependency(current, { id: createId(), source: inputParentId, target: existingInputId }))
                setCollapsed(new Set()); select(inputParentId)
              }}>Input koppelen</button>
            </> : <p role="alert">Dit gegeven bestaat niet meer. Kies opnieuw een gegevenskaart.</p>}
            <button className="full cancel-action" onClick={() => setPane('properties')}>Annuleren</button>
          </>}
          {pane === 'transformation' && canvas && <>
            <h2>{transformationTarget.edgeId ? 'Transformatie invoegen' : 'Transformatie toevoegen'}</h2>
            <p className="muted small">Kies hoe deze stap in het gewenste ontwerp wordt gerealiseerd. De app beschrijft de stap, maar voert niets uit.</p>
            <TransformationChoices onChoose={addTransformation} />
            <button className="full cancel-action" onClick={() => setPane('properties')}>Annuleren</button>
          </>}
          {pane === 'properties' && (!selected ? <>
            <h2>{canvas ? 'Canvas' : 'Werkruimte'}</h2>
            {canvas ? <><Field label="Canvasnaam" value={canvas.name} onChange={name => updateCanvas(current => { current.name = name })} /><p className="muted">Selecteer een datapunt of transformatie om de eigenschappen te bewerken.</p>
              <div className="help-block"><strong>Van resultaat naar bron</strong><p>Kies Input toevoegen op een gegevenskaart. Klik daarna op de plus op de pijl om een transformatie in te voegen. De pijlen wijzen naar het resultaat.</p></div>
              <button className="danger" onClick={() => { if (window.confirm('Dit canvas verwijderen? De globale catalogus blijft behouden. Je kunt dit ongedaan maken.')) { change(draft => { draft.canvases = draft.canvases.filter(item => item.id !== canvas.id) }); setSelectedId('') } }}>Canvas verwijderen</button></> :
              <p className="muted">Je werk wordt automatisch in deze browser opgeslagen. Exporteer regelmatig een JSON-back-up.</p>}
          </> : <>
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
          </>)}
          {pane === 'catalog' && <>
            <div className="section-heading"><h2>Data catalogus</h2><button aria-label="Nieuw catalogusitem" onClick={newCatalogItem}>+</button></div>
            <p className="muted small">Gedeeld door alle canvassen. Wijzigingen werken overal door.</p>
            <label className="field"><span>Zoeken in catalogus</span><input value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Term of synoniem" /></label>
            <div className="catalog-list">{workspace.catalog.filter(item => `${item.term} ${item.synonyms.join(' ')}`.toLocaleLowerCase('nl').includes(catalogSearch.toLocaleLowerCase('nl'))).map(item => <button className={item.id === catalogId ? 'active' : ''} key={item.id} onClick={() => setCatalogId(item.id)}>{item.term}</button>)}</div>
            {catalogItem ? <div key={catalogItem.id} className="catalog-editor">
              <Field label="Term" value={catalogItem.term} preserveDraft onChange={term => updateCatalog(catalogItem.id, { term })} hint="Uniek label; een dubbele term krijgt een volgnummer. De aangepaste term verschijnt na verlaten van dit veld." />
              <Field label="Definitie" value={catalogItem.definition} multiline onChange={definition => updateCatalog(catalogItem.id, { definition })} />
              <Field label="Synoniemen" value={catalogItem.synonyms.join('\n')} multiline onChange={text => updateCatalog(catalogItem.id, { synonyms: text.split('\n') })} hint="Eén label per regel." />
              <Field label="Afgekeurde termen" value={catalogItem.deprecatedTerms.join('\n')} multiline onChange={text => updateCatalog(catalogItem.id, { deprecatedTerms: text.split('\n') })} />
              <Field label="Eigenaar (functielabel, geen persoonsnaam)" value={catalogItem.owner} onChange={owner => updateCatalog(catalogItem.id, { owner })} />
              <Field label="Kwaliteitscriteria" value={catalogItem.qualityCriteria} multiline onChange={qualityCriteria => updateCatalog(catalogItem.id, { qualityCriteria })} />
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
            </div> : <p className="muted">Kies een item of maak een nieuw label aan.</p>}
          </>}
          {pane === 'processes' && <>
            <h2>Processen beheren</h2><p className="muted small">Lidmaatschap volgt automatisch uit de afhankelijkheden van de deliverables.</p>
            {canvas?.processes.map(process => <section className="process-editor" key={process.id}>
              <Field label="Procesnaam" value={process.name} onChange={name => updateCanvas(current => { current.processes.find(item => item.id === process.id)!.name = name })} />
              <Field label="Procesbeschrijving" value={process.description} multiline onChange={description => updateCanvas(current => { current.processes.find(item => item.id === process.id)!.description = description })} />
              <p className="small">{processMembers(canvas, process.id).size} bereikbare elementen</p>
              <button className="danger" onClick={() => { if (window.confirm('Proces verwijderen? Datapunten en transformaties blijven behouden.')) updateCanvas(current => { current.processes = current.processes.filter(item => item.id !== process.id); current.dataPoints.forEach(point => { point.deliverableProcessIds = point.deliverableProcessIds.filter(id => id !== process.id) }) }) }}>Proces verwijderen</button>
            </section>)}
            {canvas && <button className="full" onClick={() => updateCanvas(current => { current.processes.push({ id: createId(), name: 'Nieuw proces', description: '' }) })}>+ Proces toevoegen</button>}
          </>}
          {pane === 'gaps' && <>
            <h2>Gaten & signalen</h2><p className="muted small">Onzekerheid is informatie. Signalen blokkeren je ontwerp niet.</p>
            {canvas?.dataPoints.filter(point => point.deliverableProcessIds.length && (!effectiveProcess || point.deliverableProcessIds.includes(effectiveProcess))).map(point => {
              const gaps = gapsBelow(canvas, point.id, true)
              return <section className="gap-section" key={point.id}><h3>{labelFor(point, workspace.catalog)}</h3><p className="small">{gaps.length} unieke gaten, inclusief de deliverable</p>{gaps.map(element => <button className="result-link" key={element.id} onClick={() => focusElement(element.id)}><span className={`status-${element.status}`}>! {statusLabels[element.status]}</span><strong>{labelFor(element, workspace.catalog)}</strong></button>)}{!gaps.length && <p>Geen gaten in deze beslisboom.</p>}</section>
            })}
            {!canvas?.dataPoints.some(point => point.deliverableProcessIds.length) && <p className="muted">Koppel een deliverable aan een proces voor een gatenoverzicht.</p>}
            <h3>Signalen ({signals.length})</h3>{signals.map((signal, index) => <button className="result-link" key={`${signal.elementId}-${index}`} onClick={() => focusElement(signal.elementId)}><strong>{allElements.find(element => element.id === signal.elementId) ? labelFor(allElements.find(element => element.id === signal.elementId)!, workspace.catalog) : 'Element'}</strong><span>{signal.message}</span></button>)}
            {!signals.length && <p className="muted">Geen signalen.</p>}
          </>}
        </div>
      </aside>
    </div>
  </div>
}

function Connections({ canvas, selectedId, catalog, onChange, onSelect }: {
  canvas: Canvas; selectedId: string; catalog: CatalogItem[]; onChange: (update: (canvas: Canvas) => void) => void; onSelect: (id: string) => void
}) {
  const [targetId, setTargetId] = useState('')
  const [direction, setDirection] = useState('outgoing')
  const all = elements(canvas)
  const links = canvas.dependencies.filter(edge => edge.source === selectedId || edge.target === selectedId)
  return <section className="connections"><h3>Afhankelijkheden</h3>
    <p className="muted small">Pijlen wijzen van input via transformatie naar resultaat. Hieronder koppel je wat het geselecteerde element nodig heeft of waarvoor het nodig is.</p>
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
