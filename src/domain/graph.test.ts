import { describe, expect, it } from 'vitest'
import { fixture } from './fixtures.test-helper'
import { addDependency, cycleEdges, gapsBelow, insertTransformation, processMembers, reachable, removeElement, roleFor, signalsFor, visibleElements } from './graph'
import { createTransformation } from './model'
import { commit, createHistory, redo, undo } from '../state/history'

describe('graafanalyse', () => {
  it('leidt rollen en gedeeld proceslidmaatschap af', () => {
    const canvas = fixture().canvases[0]
    expect(roleFor(canvas, 'point-0')).toBe('result')
    expect(roleFor(canvas, 'point-2')).toBe('source')
    expect(processMembers(canvas, 'process-a').has('point-2')).toBe(true)
    expect(processMembers(canvas, 'process-b').has('point-2')).toBe(true)
    canvas.dependencies.push({ id: 'extra', source: 'point-2', target: 'transform-b' })
    expect(roleFor(canvas, 'point-2')).toBe('intermediate')
  })
  it('telt unieke gaten en sluit zichzelf uit, ook bij cycli', () => {
    const canvas = fixture().canvases[0]
    canvas.dependencies.push({ id: 'shared', source: 'transform-a', target: 'point-1' }, { id: 'cycle', source: 'point-2', target: 'transform-a' })
    expect(gapsBelow(canvas, 'point-0').map(item => item.id).sort()).toEqual(['point-1', 'point-2', 'transform-a', 'transform-b'])
    expect(gapsBelow(canvas, 'point-0', true)).toHaveLength(5)
    expect(cycleEdges(canvas).has('cycle')).toBe(true)
    expect(reachable(canvas, ['point-0']).size).toBe(5)
  })
  it('behoudt gedeelde elementen zolang een andere tak open is', () => {
    const canvas = fixture().canvases[0]
    const oneClosed = visibleElements(canvas, '', new Set(['transform-a']))
    expect(oneClosed.has('point-2')).toBe(true)
    const bothClosed = visibleElements(canvas, '', new Set(['transform-a', 'transform-b']))
    expect(bothClosed.has('point-2')).toBe(false)
    expect(visibleElements(canvas, 'process-a', new Set(['transform-a'])).has('point-2')).toBe(false)
    expect(visibleElements(canvas, '', new Set()).has('point-2')).toBe(true)
  })
  it('behoudt losse cyclische componenten zonder deliverable', () => {
    const canvas = fixture().canvases[0]
    canvas.dataPoints.forEach(point => { point.deliverableProcessIds = [] })
    canvas.dependencies.push({ id: 'cycle', source: 'point-2', target: 'point-0' })
    expect(visibleElements(canvas, '', new Set()).size).toBe(5)
  })
  it('signaleert conflicten maar behoudt alle relaties', () => {
    const canvas = fixture().canvases[0]
    addDependency(canvas, { id: 'second', source: 'point-0', target: 'transform-b' })
    addDependency(canvas, { id: 'duplicate', source: 'point-0', target: 'transform-b' })
    expect(canvas.dependencies).toHaveLength(5)
    expect(signalsFor(canvas).some(signal => signal.message.includes('Meerdere producerende'))).toBe(true)
    expect(signalsFor(canvas).some(signal => signal.message.includes('meerdere outputs'))).toBe(true)
    canvas.transformations.push({ ...createTransformation(), id: 'isolated', name: 'Losse bewerking', type: 'lookup' })
    expect(signalsFor(canvas).filter(signal => signal.elementId === 'isolated').map(signal => signal.message)).toEqual(expect.arrayContaining(['Hoort bij geen enkel proces.', 'Transformatie zonder input.', 'Transformatie zonder output.']))
  })
  it('verwijdert alleen het gekozen element en zijn verbindingen', () => {
    const canvas = fixture().canvases[0]
    removeElement(canvas, 'transform-a')
    expect(canvas.dataPoints).toHaveLength(3)
    expect(canvas.dependencies).toHaveLength(2)
    expect(canvas.transformations).toHaveLength(1)
  })
  it('houdt beschikbaarheid en EPIC onafhankelijk van ontwerpzekerheid en gaten', () => {
    const canvas = fixture().canvases[0]
    const transformation = canvas.transformations[0]
    transformation.availability = 'available'
    expect(gapsBelow(canvas, 'point-0').some(item => item.id === transformation.id)).toBe(true)
    transformation.status = 'described'
    transformation.availability = 'toBuild'
    transformation.epic = 'EPIC-verwijzing'
    expect(gapsBelow(canvas, 'point-0').some(item => item.id === transformation.id)).toBe(false)
  })
  it('voegt atomair een transformatie in zonder gedeelde relaties te verliezen, met undo en redo', () => {
    const workspace = fixture()
    const initial = structuredClone(workspace)
    const canvas = workspace.canvases[0]
    addDependency(canvas, { id: 'direct', source: 'point-0', target: 'point-2' })
    addDependency(initial.canvases[0], { id: 'direct', source: 'point-0', target: 'point-2' })
    expect(signalsFor(canvas).some(signal => signal.message.includes('Transformatie nog niet beschreven'))).toBe(true)
    const sharedLinks = canvas.dependencies.filter(edge => edge.id !== 'direct')
    const id = insertTransformation(canvas, 'direct', 'api')
    expect(canvas.transformations.find(item => item.id === id)?.realization).toBe('api')
    expect(canvas.dependencies).toEqual(expect.arrayContaining(sharedLinks))
    expect(canvas.dependencies.filter(edge => edge.source === id || edge.target === id)).toEqual([
      expect.objectContaining({ source: 'point-0', target: id }),
      expect.objectContaining({ source: id, target: 'point-2' }),
    ])
    expect(canvas.dependencies.some(edge => edge.id === 'direct')).toBe(false)
    expect(processMembers(canvas, 'process-a').has(id)).toBe(true)
    expect(canvas.dataPoints).toHaveLength(3)
    const history = commit(createHistory(initial), workspace)
    expect(undo(history).present).toEqual(initial)
    expect(redo(undo(history)).present).toEqual(workspace)
  })
  it('behoudt zelfverwijzingen bij invoegen en weigert verouderde of reeds getransformeerde verbindingen zonder mutatie', () => {
    const canvas = fixture().canvases[0]
    addDependency(canvas, { id: 'self', source: 'point-2', target: 'point-2' })
    const id = insertTransformation(canvas, 'self', 'agentic')
    expect(cycleEdges(canvas).size).toBe(2)
    expect(reachable(canvas, [id]).size).toBe(2)
    const before = structuredClone(canvas)
    expect(() => insertTransformation(canvas, 'self', 'api')).toThrow('gewijzigd')
    expect(() => insertTransformation(canvas, 'edge-a', 'api')).toThrow('gewijzigd')
    expect(canvas).toEqual(before)
  })
})
