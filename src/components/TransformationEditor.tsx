import { availabilityLabels, realizationLabels, realizationTypes, transformationTypes, type Canvas, type CatalogItem, type Transformation } from '../domain/model'
import { Field } from './Field'
import { Icon } from './Icon'

const typeLabels = { calculation: 'Berekening', decision: 'Beslisregel', lookup: 'Opzoeking', extraction: 'Extractie', validation: 'Validatie', interpretation: 'Menselijke interpretatie' }
const descriptions = {
  forcze: 'Een medewerker vraagt gegevens uit of beoordeelt ze in de UI van Forcze.',
  api: 'Beschrijf welke API-operatie de benodigde gegevens levert. Alleen het ontwerp, geen aanroepen.',
  automation: 'Beschrijf hoe een businessrule inputs omzet in een resultaat.',
  agentic: 'Beschrijf de taak voor genAI en de kaders waarbinnen deze stap moet werken.',
}
const logicLabels = { forcze: 'Uitvraag of beoordelingsinstructie', api: 'Beschrijving API-uitvraag', automation: 'Businessrule', agentic: 'Taak en instructie voor genAI' }

export function TransformationChoices({ onChoose }: { onChoose: (type: Transformation['realization']) => void }) {
  return <div className="transformation-choices">{realizationTypes.map(type =>
    <button key={type} className={`type-choice realization-${type}`} onClick={() => onChoose(type)}>
      <Icon name={type} /><span><b>{realizationLabels[type]}</b><small>{descriptions[type]}</small></span>
    </button>)}</div>
}

export function TransformationEditor({ transformation: item, canvas, catalog, onChange }: {
  transformation: Transformation; canvas: Canvas; catalog: CatalogItem[]; onChange: (patch: Partial<Transformation>) => void
}) {
  const inputs = canvas.dependencies.filter(edge => edge.source === item.id).map(edge => edge.target)
  const outputs = canvas.dependencies.filter(edge => edge.target === item.id).map(edge => edge.source)
  function labels(ids: string[]) {
    return canvas.dataPoints.filter(point => ids.includes(point.id)).map(point => catalog.find(entry => entry.id === point.catalogItemId)?.term ?? 'Catalogusverwijzing ontbreekt')
  }
  return <>
    <div className={`transformation-heading realization-${item.realization}`}><Icon name={item.realization} /><div><b>{realizationLabels[item.realization]}</b><p>{descriptions[item.realization]}</p></div></div>
    <Field label="Naam transformatie" value={item.name} onChange={name => onChange({ name })} />
    <label className="field"><span>Type transformatie</span><select aria-label="Type transformatie" value={item.realization} onChange={event => onChange({ realization: event.target.value as Transformation['realization'] })}>{realizationTypes.map(type => <option key={type} value={type}>{realizationLabels[type]}</option>)}</select></label>
    <label className="field"><span>Beschikbaarheid</span><select aria-label="Beschikbaarheid" value={item.availability} onChange={event => onChange({ availability: event.target.value as Transformation['availability'] })}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {item.availability === 'toBuild' && <Field label="EPIC-nummer" value={item.epic} onChange={epic => onChange({ epic })} hint="Optionele verwijzing naar de nog te bouwen stap." />}
    <section className="transformation-ports" aria-label="Inputs en output"><h3>Inputs en output</h3>
      <div><b>Inputs</b>{labels(inputs).map((label, index) => <span key={index}>{label}</span>)}{!labels(inputs).length && <span className="muted">Nog geen input gekoppeld.</span>}</div>
      <div><b>Output</b>{labels(outputs).map((label, index) => <span key={index}>{label}</span>)}{!labels(outputs).length && <span className="muted">Nog geen output gekoppeld.</span>}</div>
    </section>
    {item.realization === 'forcze' && <label className="field"><span>Interactie in Forcze</span><select aria-label="Interactie in Forcze" value={item.interaction} onChange={event => onChange({ interaction: event.target.value as Transformation['interaction'] })}><option value="request">Uitvraag</option><option value="assessment">Beoordeling</option><option value="both">Uitvraag en beoordeling</option></select></label>}
    {item.realization === 'api' && <Field label="API en operatie" value={item.apiOperation} onChange={apiOperation => onChange({ apiOperation })} hint="Alleen een naam of beschrijving, geen credentials of requestwaarden." />}
    <Field label={logicLabels[item.realization]} multiline value={item.logic} onChange={logic => onChange({ logic })} hint="Beschrijf de gewenste werking, nooit inhoudelijke waarden." />
    {item.realization === 'automation' && <Field label="Voorwaarden voor de businessrule" multiline value={item.conditions} onChange={conditions => onChange({ conditions })} />}
    {item.realization === 'agentic' && <>
      <Field label="Kaders voor genAI" multiline value={item.guardrails} onChange={guardrails => onChange({ guardrails })} />
      <Field label="Menselijke controle" multiline value={item.humanReview} onChange={humanReview => onChange({ humanReview })} />
    </>}
    <details className="logical-details"><summary>Logisch type en ontwerpzekerheid</summary>
      <label className="field"><span>Logisch type (optioneel)</span><select aria-label="Logisch type (optioneel)" value={item.type} onChange={event => onChange({ type: event.target.value as Transformation['type'] })}><option value="">Niet gekozen</option>{transformationTypes.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
      <label className="field"><span>Status transformatie</span><select aria-label="Status transformatie" value={item.status} onChange={event => onChange({ status: event.target.value as Transformation['status'] })}><option value="undescribed">Onbeschreven</option><option value="assumed">Aanname</option><option value="described">Beschreven</option></select></label>
    </details>
    <Field label="Notities transformatie" multiline value={item.notes} onChange={notes => onChange({ notes })} />
  </>
}
