// src/components/OwnersBoard.jsx — Filterable owner view + drill-down
import React, { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

const TYPES = ['Estimate','Info Request','Meeting','Payment Request','Projection','Return Sent','Strategy Memo']
const STATUSES = ['Planned','Requested','Sent','Completed']

export default function OwnersBoard({ owners, clients, onDrill }){
  const [ownerId, setOwnerId] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear] = useState('')
  const [q, setQ] = useState('')

  const ownerById = useMemo(() => new Map(owners.map(o => [o.id, o])), [owners])

  const rows = useMemo(() => {
    const out = []
    for (const c of clients || []){
      const delivs = c.deliverables || []
      for (const d of delivs){
        const taxYear = d.taxYear ?? yearOf(d.date) ?? c.year ?? null
        const id = d.id || `${c.id}-${taxYear}-${d.type}-${d.date}`
        const oId = d.ownerId || ''
        const oName = (oId && ownerById.get(oId)?.name) || 'Unassigned'
        out.push({ id, clientId: c.id, clientName: c.group || c.client || '—', taxYear, type: d.type, status: d.status, ownerId: oId, ownerName: oName, date: d.date || '', notes: d.notes || '' })
      }
    }
    out.sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')))
    return out
  }, [clients, ownerById])

  const allYears = useMemo(() => {
    const s = new Set()
    for (const r of rows){ if (r.taxYear) s.add(Number(r.taxYear)) }
    return Array.from(s).sort((a,b)=>b-a)
  }, [rows])

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase()
    return rows.filter(r => {
      if (ownerId && (r.ownerId || '') !== ownerId) return false
      if (type && r.type !== type) return false
      if (status && r.status !== status) return false
      if (year && Number(r.taxYear) !== Number(year)) return false
      if (text && !(`${r.clientName} ${r.type} ${r.notes} ${r.taxYear}`.toLowerCase().includes(text))) return false
      return true
    })
  }, [rows, ownerId, type, status, year, q])

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <h2 className="text-2xl font-semibold">Owner Deliverables Board</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Input className="pl-8" placeholder="Search (client / type / notes / year)" value={q} onChange={e=>setQ(e.target.value)} />
            <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-60" />
          </div>
          <select className="border rounded-xl px-3 py-2 bg-white" value={ownerId} onChange={e=>setOwnerId(e.target.value)}>
            <option value="">All Owners</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2 bg-white" value={type} onChange={e=>setType(e.target.value)}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2 bg-white" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2 bg-white" value={year} onChange={e=>setYear(e.target.value)}>
            <option value="">All Years</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {owners.length === 0 && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No owners found. Go to <b>Owners Admin</b> to add some.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(r => (
          <Card key={r.id} className="hover:shadow cursor-pointer" onClick={()=>onDrill(r.clientId, r.taxYear)}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.type}</div>
                <div className="text-xs text-gray-600">{r.status}</div>
              </div>
              <div className="text-sm text-gray-700">{r.clientName} — {r.taxYear || '—'}</div>
              <div className="text-xs text-gray-500">Owner: {r.ownerName}</div>
              {r.date && <div className="text-xs text-gray-500">Date: {r.date}</div>}
              {r.notes && <div className="text-xs text-gray-500 line-clamp-2">{r.notes}</div>}
            </CardContent>
          </Card>
        ))}
        {!filtered.length && (
          <div className="text-sm text-gray-600">No deliverables match your filters.</div>
        )}
      </div>
    </div>
  )
}

function yearOf(dateStr){
  if (!dateStr || typeof dateStr !== 'string') return null
  const m = /^(\d{4})-/.exec(dateStr.trim())
  return m ? Number(m[1]) : null
}
