import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyWorkspace, type Workspace } from '../domain/model'
import { loadWorkspace, saveWorkspace } from '../storage/database'
import { commit, createHistory, redo, undo } from './history'

export function useWorkspace() {
  const [history, setHistory] = useState(() => createHistory(emptyWorkspace()))
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('Laden…')
  const [retry, setRetry] = useState(0)
  const queue = useRef(Promise.resolve())
  const revision = useRef(0)
  const latest = useRef(history.present)
  latest.current = history.present
  useEffect(() => {
    let active = true
    loadWorkspace().then(workspace => {
      if (active) { setHistory(createHistory(workspace)); setReady(true) }
    }).catch((cause: unknown) => { if (active) setError(`Opslag kon niet worden geopend: ${String(cause)}. Herlaad de app om opnieuw te proberen.`) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!ready) return
    const current = ++revision.current
    setSaveStatus('Opslaan…')
    queue.current = queue.current.then(async () => {
      if (current !== revision.current) return
      try {
        await saveWorkspace(history.present)
        if (revision.current === current) { setSaveStatus('Lokaal opgeslagen'); setError('') }
      } catch (cause) {
        if (revision.current === current) {
          setSaveStatus('Niet opgeslagen')
          setError(`Opslaan mislukt: ${String(cause)}. Je werk blijft hier beschikbaar; exporteer een back-up of probeer opnieuw.`)
        }
      }
    })
  }, [history.present, ready, retry])
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (saveStatus !== 'Lokaal opgeslagen' && ready) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [saveStatus, ready])
  const change = useCallback((update: (workspace: Workspace) => void) => {
    setHistory(previous => {
      const next = structuredClone(previous.present)
      update(next)
      if (JSON.stringify(next) === JSON.stringify(previous.present)) return previous
      return commit(previous, next)
    })
  }, [])
  const replace = useCallback((workspace: Workspace) => setHistory(previous => commit(previous, workspace)), [])
  return {
    workspace: history.present, ready, error, saveStatus, change, replace,
    readWorkspace: useCallback(() => latest.current, []),
    canUndo: !!history.past.length, canRedo: !!history.future.length,
    undo: useCallback(() => setHistory(undo), []), redo: useCallback(() => setHistory(redo), []),
    retry: () => setRetry(value => value + 1),
  }
}
