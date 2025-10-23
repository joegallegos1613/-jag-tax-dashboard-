import React from 'react'
import { useOwners } from '../context/OwnersContext'

export default function OwnerSelect({ value = [], onChange, multi = true, placeholder = 'Select owner(s)…' }) {
  const { owners } = useOwners()

  if (!multi) {
    return (
      <select
        className="w-full rounded-xl border p-2"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {owners.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    )
  }

  // simple multi‑select with checkboxes
  const toggle = (id) => {
    const set = new Set(value)
    set.has(id) ? set.delete(id) : set.add(id)
    onChange(Array.from(set))
  }

  return (
    <div className="rounded-xl border p-2">
      <div className="text-sm opacity-70 mb-2">{placeholder}</div>
      <div className="flex flex-col gap-2 max-h-48 overflow-auto">
        {owners.length === 0 && (
          <div className="text-sm opacity-60">No owners yet. Add owners in the Owners tab.</div>
        )}
        {owners.map(o => (
          <label key={o.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(o.id)}
              onChange={() => toggle(o.id)}
            />
            <span>{o.name}</span>
            {o.role && <span className="text-xs opacity-60">· {o.role}</span>}
          </label>
        ))}
      </div>
    </div>
  )
}