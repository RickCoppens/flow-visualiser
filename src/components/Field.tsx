import { useEffect, useId, useState } from 'react'

export function Field({ label, value, onChange, multiline = false, hint, placeholder, preserveDraft = false }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string; placeholder?: string; preserveDraft?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => { if (document.activeElement?.id !== id) setDraft(value) }, [value, id])
  const props = {
    id, value: preserveDraft ? draft : value, placeholder,
    'aria-labelledby': `${id}-label`, 'aria-describedby': hint ? `${id}-hint` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(event.target.value); onChange(event.target.value) },
    onBlur: () => setDraft(value),
  }
  return <label className="field" htmlFor={id}><span id={`${id}-label`}>{label}</span>
    {multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </label>
}
