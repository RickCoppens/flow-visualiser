import type { Workspace } from '../domain/model'

export interface History { present: Workspace; past: Workspace[]; future: Workspace[] }
export const createHistory = (present: Workspace): History => ({ present, past: [], future: [] })
export function commit(history: History, present: Workspace): History {
  return { past: [...history.past, history.present], present, future: [] }
}
export function undo(history: History): History {
  if (!history.past.length) return history
  return { present: history.past.at(-1)!, past: history.past.slice(0, -1), future: [history.present, ...history.future] }
}
export function redo(history: History): History {
  if (!history.future.length) return history
  return { present: history.future[0], past: [...history.past, history.present], future: history.future.slice(1) }
}
