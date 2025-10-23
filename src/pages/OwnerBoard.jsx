import React, { useMemo, useState } from 'react'
import { useOwners } from '../context/OwnersContext'
import OwnerSelect from '../components/OwnerSelect'

const TYPES = ['Estimate','Meeting','Request','Return','Other']
const STATUSES = ['Not Started','In Progress','Waiting on Client','Blocked','Done']

export default function OwnerBoard() {
  const { owners, deliverables, updateDeliverable } = useOwners()
  const [ownerFilter, setOwnerFilter] = useState([]) // ownerIds
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return deliverables.filter(d => {
      if (ownerFilter.length && !ownerFilter.some(id => (d.ownerIds||[]).includes(id))) return false
      if (typeFilter && d.type !== typeFilter) return false
      if (statusFilter && d.status !== statusFilter) return false
      if (query && !(`${d.title} ${d.clientName} ${d.taxYear}`.toLowerCase().includes(query.toLowerCase()))) return false
      return true
    })
  }, [deliverables, ownerFilter, typeFilter, statusFilter, query])

  const byOwner = useMemo(() => {
    const map = new Map()
    for (const d of filtered) {
      const ids = d.ownerIds && d.ownerIds.length ? d.ownerIds : ['__unassigned__']
      ids.forEach(id => {
        const key = id
        const arr = map.get(key) || []
        arr.push(d)
        map.set(key, arr)
      })
    }
    return map
  }, [filtered])

  const nameOf = (id) => {
    if (id === '__unassigned__') return 'Unassigned'
    return owners.find(o => o.id === id)?.name || 'Unknown'
  }

  const navigateToDetail = (d) => {
    // 🔁 Replace with your real navigation if you have a router
    const slug = encodeURIComponent(`${d.clientName} – ${d.taxYear}`)
    alert(`Open detail: ${slug}`)
  }

  const unassign = (d, ownerId) => {
    const next = { ...d, ownerIds: (d.ownerIds||[]).filter(id => id !== ownerId) }
    updateDeliverable(next)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Owner Board</h1>
        <div className="flex gap-2">
          <input className="rounded-xl border p-2" placeholder="Search (title / client / year)" value={query} onChange={e=>setQuery(e.target.value)} />
          <select className="rounded-xl border p-2" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="rounded-xl border p-2" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <OwnerSelect value={ownerFilter} onChange={setOwnerFilter} multi placeholder="Filter by owner(s)" />
      </div>

      {byOwner.size === 0 && (
        <div className="opacity-60">No deliverables match your filters.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...byOwner.entries()].map(([ownerId, items]) => (
          <div key={ownerId} className="bg-white rounded-2xl p-4 shadow">
            <div className="font-semibold mb-2">{nameOf(ownerId)} <span className="text-sm opacity-60">({items.length})</span></div>
            <div className="flex flex-col gap-2">
              {items.map(d => (
                <div key={d.id} className="rounded-xl border p-3 hover:shadow cursor-pointer" onClick={()=>navigateToDetail(d)}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.title}</div>
                    <div className="text-xs opacity-70">{d.type} · {d.status}</div>
                  </div>
                  <div className="text-sm opacity-70">{d.clientName} — {d.taxYear}</div>
                  {ownerId !== '__unassigned__' && (
                    <button
                      className="mt-2 text-xs rounded-lg border px-2 py-1"
                      onClick={(e)=>{e.stopPropagation(); unassign(d, ownerId)}}
                    >Unassign</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}