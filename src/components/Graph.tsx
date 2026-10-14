import { useEffect, useMemo, useState } from 'react'
import { Background, BaseEdge, Controls, EdgeLabelRenderer, getSmoothStepPath, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Node, type NodeProps, type Edge, type EdgeProps } from '@xyflow/react'
import { availabilityLabels, elements, isDataPoint, labelFor, realizationLabels, type Canvas, type CatalogItem, type Transformation } from '../domain/model'
import { cycleEdges, gapsBelow, processMembers, roleFor, visibleElements } from '../domain/graph'
import { LAYER_SPACING, layoutGraph, NODE_HEIGHT, NODE_WIDTH } from '../graph/layout'
import { Icon } from './Icon'

export const palette = ['#315f86', '#6b5188', '#497154', '#966126', '#8f4d60']
export const statusLabels: Record<string, string> = {
  known: 'Bekend', missing: 'Ontbrekend', assumed: 'Aanname', described: 'Beschreven', undescribed: 'Onbeschreven',
}
const roleLabels = { source: 'Brongegeven', intermediate: 'Tussenresultaat', result: 'Eindresultaat' }
type FlowNode = Node<{ label: string; status: string; kind: string; gaps: number; shared: boolean; deliverable: boolean; collapsed: boolean; color: string; toggle: () => void; addInput: () => void; transformation?: Transformation }>
function ElementNode({ data }: NodeProps<FlowNode>) {
  const transformation = data.transformation
  return <div className={`element-node ${transformation ? `transformation realization-${transformation.realization}` : ''}`} style={transformation ? undefined : { borderTopColor: data.color }}>
    <Handle type="source" position={Position.Top} />
    <div className="node-kind">{data.deliverable ? 'Deliverable' : data.kind}{data.shared && <span title="Bereikbaar vanuit meerdere processen">Gedeeld</span>}</div>
    {transformation && <div className="node-realization"><Icon name={transformation.realization} /><span>{realizationLabels[transformation.realization]}</span></div>}
    <strong title={data.label}>{data.label}</strong>
    {transformation && <div className={`availability availability-${transformation.availability}`}>{availabilityLabels[transformation.availability]}</div>}
    <div className={`node-status status-${data.status}`}><span aria-hidden>{data.status === 'known' || data.status === 'described' ? '✓' : data.status === 'assumed' ? '?' : '!'}</span> {statusLabels[data.status]}</div>
    {!transformation && <button className="node-add-input nodrag nopan" aria-label={`Input toevoegen: ${data.label}`} onClick={event => { event.stopPropagation(); data.addInput() }}>+ Input toevoegen</button>}
    <div className="node-footer"><span>Onderliggende gaten: {data.gaps}</span><button className="nodrag nopan" onClick={event => { event.stopPropagation(); data.toggle() }} aria-label={data.collapsed ? `Uitklappen: ${data.label}` : `Inklappen: ${data.label}`}>{data.collapsed ? '+' : '−'}</button></div>
    <Handle type="target" position={Position.Bottom} />
  </div>
}
const nodeTypes = { element: ElementNode }
type FlowEdge = Edge<{ insert: boolean; cycle: boolean; detourX?: number; onOpen: () => void }>
function DependencyEdge(props: EdgeProps<FlowEdge>) {
  let [path, x, y] = getSmoothStepPath(props)
  if (props.data?.detourX !== undefined) {
    x = props.data.detourX
    y = (props.sourceY + props.targetY) / 2
    path = `M ${props.sourceX} ${props.sourceY} L ${props.sourceX} ${props.sourceY - 24} L ${x} ${props.sourceY - 24} L ${x} ${props.targetY + 24} L ${props.targetX} ${props.targetY + 24} L ${props.targetX} ${props.targetY}`
  }
  return <>
    <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={28} />
    {props.data?.insert && <EdgeLabelRenderer><button className="edge-insert nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}
      aria-label="Transformatie invoegen" title="Transformatie nog niet beschreven. Kies een type." onClick={event => { event.stopPropagation(); props.data?.onOpen() }}>+</button></EdgeLabelRenderer>}
    {props.data?.cycle && <EdgeLabelRenderer><span className="edge-cycle" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y + 25}px)` }}>Terugverwijzing</span></EdgeLabelRenderer>}
  </>
}
const edgeTypes = { dependency: DependencyEdge }
interface Props {
  canvas: Canvas; catalog: CatalogItem[]; processId: string; selectedId: string;
  collapsed: Set<string>; onToggle: (id: string) => void; onSelect: (id: string) => void;
  onConnect: (source: string, target: string) => void; focusId: string; focusRevision: number
  onAddInput: (id: string) => void; onOpenEdge: (id: string) => void
}
function GraphContent(props: Props) {
  const { canvas, catalog, processId, selectedId, collapsed, onToggle, onSelect, onConnect, focusId, focusRevision } = props
  const [positions, setPositions] = useState(new Map<string, { x: number; y: number }>())
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const flow = useReactFlow()
  useEffect(() => {
    let active = true
    layoutGraph(canvas, catalog, processId, collapsed).then(result => {
      if (!active) return
      setPositions(previous => JSON.stringify([...previous]) === JSON.stringify([...result]) ? previous : result)
      setError('')
    }).catch((cause: unknown) => { if (active) setError(`Layout mislukt: ${String(cause)}. Je gegevens blijven behouden.`) })
    return () => { active = false }
  }, [canvas, catalog, processId, collapsed])
  useEffect(() => {
    if (connecting) return
    const timer = window.setTimeout(() => {
      void flow.fitView({ nodes: focusId ? [{ id: focusId }] : undefined, padding: 0.22, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200, maxZoom: 1 })
    }, 40)
    return () => window.clearTimeout(timer)
  }, [positions, focusId, focusRevision, flow, connecting])
  const visible = useMemo(() => visibleElements(canvas, processId, collapsed), [canvas, processId, collapsed])
  const members = canvas.processes.map(process => processMembers(canvas, process.id))
  const nodes: FlowNode[] = elements(canvas).filter(element => visible.has(element.id)).map(element => {
    const processIndex = members.findIndex(set => set.has(element.id))
    return {
      id: element.id, type: 'element', selected: element.id === selectedId, width: NODE_WIDTH, height: NODE_HEIGHT,
      measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
      position: positions.get(element.id) ?? { x: 0, y: 0 },
      ariaLabel: labelFor(element, catalog),
      data: {
        label: labelFor(element, catalog), status: element.status,
        kind: isDataPoint(element) ? roleLabels[roleFor(canvas, element.id)] : 'Transformatie',
        gaps: gapsBelow(canvas, element.id).length, shared: members.filter(set => set.has(element.id)).length > 1,
        deliverable: isDataPoint(element) && !!element.deliverableProcessIds.length,
        color: palette[processIndex % palette.length] ?? '#687784', collapsed: collapsed.has(element.id),
        toggle: () => onToggle(element.id),
        addInput: () => props.onAddInput(element.id),
        transformation: isDataPoint(element) ? undefined : element,
      },
    }
  })
  const cycles = cycleEdges(canvas)
  const edges: FlowEdge[] = canvas.dependencies.filter(edge => visible.has(edge.source) && visible.has(edge.target) && !collapsed.has(edge.source)).map((edge, index) => ({
    ...edge, source: edge.target, target: edge.source, type: 'dependency',
    ariaLabel: `Gegevensstroom van ${labelFor(elements(canvas).find(item => item.id === edge.target)!, catalog)} naar ${labelFor(elements(canvas).find(item => item.id === edge.source)!, catalog)}`,
    data: {
      insert: canvas.dataPoints.some(point => point.id === edge.source) && canvas.dataPoints.some(point => point.id === edge.target),
      cycle: cycles.has(edge.id),
      // Skip-layer links need a side lane so their controls do not cover intervening cards.
      detourX: edge.source === edge.target || Math.abs((positions.get(edge.source)?.y ?? 0) - (positions.get(edge.target)?.y ?? 0)) > NODE_HEIGHT + LAYER_SPACING + 1
        ? Math.max(...nodes.map(node => node.position.x + NODE_WIDTH)) + 40 + index * 12 : undefined,
      onOpen: () => props.onOpenEdge(edge.id),
    },
    style: { stroke: cycles.has(edge.id) ? '#a24a32' : '#738593', strokeWidth: 1.5, strokeLinejoin: 'round', strokeDasharray: cycles.has(edge.id) ? '6 4' : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color: cycles.has(edge.id) ? '#a24a32' : '#738593' },
  }))
  return <>
    {error && <div role="alert" className="graph-error">{error}</div>}
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable onConnect={connection => onConnect(connection.target, connection.source)}
      aria-busy={nodes.some(node => !positions.has(node.id))}
      onConnectStart={() => setConnecting(true)} onConnectEnd={() => setConnecting(false)}
      onEdgeClick={(_, edge) => props.onOpenEdge(edge.id)}
      onKeyDownCapture={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const edge = event.target instanceof Element ? event.target.closest('.react-flow__edge') : null
        const id = edge?.getAttribute('data-id')
        if (id) { event.preventDefault(); event.stopPropagation(); props.onOpenEdge(id) }
      }}
      onNodeClick={(_, node) => onSelect(node.id)} onPaneClick={() => onSelect('')} fitView minZoom={0.15} maxZoom={1.8}
      onNodesChange={changes => { const selection = changes.find(change => change.type === 'select' && change.selected); if (selection?.type === 'select') onSelect(selection.id) }}
      deleteKeyCode={null} attributionPosition="top-right"
      ariaLabelConfig={{
        'controls.ariaLabel': 'Graafbediening',
        'controls.zoomIn.ariaLabel': 'Inzoomen', 'controls.zoomOut.ariaLabel': 'Uitzoomen', 'controls.fitView.ariaLabel': 'Alles in beeld', 'controls.interactive.ariaLabel': 'Interactie wisselen',
        'node.a11yDescription.default': 'Druk op Enter om de eigenschappen te openen. Gebruik Tab om verder te navigeren.',
        'node.a11yDescription.keyboardDisabled': 'Datapunt of transformatie. Gebruik de eigenschappen om te bewerken.',
        'edge.a11yDescription.default': 'Gegevensstroom naar het resultaat. Druk op Enter om een transformatie in te voegen of te openen.',
        'node.a11yDescription.ariaLiveMessage': () => 'Element geselecteerd.',
      }}>
      <Background color="#d0d7de" gap={24} size={1} /><Controls showInteractive={false} />
    </ReactFlow>
  </>
}
export function Graph(props: Props) {
  return <ReactFlowProvider><GraphContent {...props} /></ReactFlowProvider>
}
