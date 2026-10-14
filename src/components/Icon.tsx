type IconName = 'canvas' | 'catalog' | 'import' | 'export' | 'undo' | 'redo' | 'forcze' | 'api' | 'automation' | 'agentic' | 'menu' | 'edit' | 'delete' | 'chevron'

const paths: Record<IconName, string> = {
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  edit: 'm15 4 5 5 M4 20l5-1L21 7l-5-5L4 14z',
  delete: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  chevron: 'm6 9 6 6 6-6',
  canvas: 'M4 4h16v16H4z M9 4v16 M4 9h16',
  catalog: 'M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h3',
  import: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  export: 'M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5',
  undo: 'M9 5 4 10l5 5 M4 10h9a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5 M20 10h-9a6 6 0 0 0 0 12',
  forcze: 'M4 4h16v13H9l-5 4z M8 8h8 M8 12h5',
  api: 'm8 5-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18',
  automation: 'M13 2 4 14h7l-1 8 10-13h-8z',
  agentic: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 6l2 4 4 2-4 2-2 4-2-4-4-2 4-2z',
}

export function Icon({ name }: { name: IconName }) {
  return <svg className="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
