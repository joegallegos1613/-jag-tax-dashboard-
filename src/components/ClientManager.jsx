// src/components/ClientManager.jsx — Supabase-live CRUD
import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

import {
  getClients,
  subscribe as subscribeClients,
  addClientRow,
  updateClientRow,
  removeClientRow,
} from '@/store/clientsStore'

const ENTITY_TYPES = [
  'Individual','S-Corp','C-Corp','Partnership','LLC (Disregarded)','Sole Prop','Trust/Estate','Other'
]

export default function ClientManager(){
  const [clients, setClients] = useState(getClients())
  useEffect(() => {
    const unsub = subscribeClients(setClients)
    setClients(getClients())
    return unsub
  }, [])

  const [form, setForm] = useState({
    group: '',
    client: '',
    entity: 'Individual',
    year: new Date().getFullYear(),
    serviceLevel: 'Clarity',
    risk: 'Low',
  })
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let base = clients
    if (q) base = base.filter(c => (`${c.group} ${c.client} ${c.entity} ${c.notes||''}`).toLowerCase().includes(q))
    return base
  }, [clients, query])

  async function handleAdd(e){
    e.preventDefault()
    const y = Number(form.year) || new Date().getFullYear()
    const payload = {
      group: form.group.trim(),
      client: form.client.trim(),
      entity: form.entity || 'Individual',
      years: [y],
      year: y,
      serviceLevel: form.serviceLevel,
      serviceLevelByYear: { [y]: form.serviceLevel },
      risk: form.risk,
      safeHarborByYear: { [y]: 0 },
      deliverablesProgress: 0,
      strategies: [],
      deliverables: [],
      estimateOwner: '',
      meetingOwner: '',
      requestOwner: '',
      paymentRequests: [
        { quarter: 'Q1', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Q2', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
      ]
    }
    if (!payload.group) return
    await addClientRow(payload)
    setForm({ group:'', client:'', entity:'Individual', year:new Date().getFullYear(), serviceLevel:'Clarity', risk:'Low' })
  }

  function startEdit(c){
    setEditingId(c.id)
    setForm({
      group: c.group || '',
      client: c.client || '',
      entity: c.entity || 'Individual',
      year: (c.years?.[0]) || c.year || new Date().getFullYear(),
      serviceLevel: (c.serviceLevelByYear && c.years?.length && c.serviceLevelByYear[c.years[0]]) || c.serviceLevel || 'Clarity',
      risk: c.risk || 'Low'
    })
  }

  async function saveEdit(){
    const y = Number(form.year) || new Date().getFullYear()
    await updateClientRow(editingId, {
      group: form.group.trim(),
      client: form.client.trim(),
      entity: form.entity,
      years: [y],
      year: y,
      serviceLevelByYear: { [y]: form.serviceLevel },
      risk: form.risk,
    })
    setEditingId(null)
  }

  async function addYear(clientId, year){
    const c = clients.find(x => x.id === clientId)
    const yList = Array.from(new Set([...(c.years || []), Number(year)]))
    await updateClientRow(clientId, { years: yList })
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Client Manager</h1>
        <div className="relative w-80">
          <Input className="pl-8" placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)} />
          <Search className="absolute left-2 top-2 h-4 w-4 opacity-60" />
        </div>
      </div>

      {/* Add / Edit form */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <form onSubmit={editingId ? (e=>{e.preventDefault(); saveEdit()}) : handleAdd} className="grid gap-3 sm:grid-cols-6">
            <Input className="sm:col-span-2" placeholder="Group (e.g., Riverstone Ventures LLC)" value={form.group} onChange={e=>setForm(s=>({...s, group:e.target.value}))} />
            <Input className="sm:col-span-2" placeholder="Client contact (optional)" value={form.client} onChange={e=>setForm(s=>({...s, client:e.target.value}))} />
            <select className="rounded-xl border p-2" value={form.entity} onChange={e=>setForm(s=>({...s, entity:e.target.value}))}>
              {ENTITY_TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
            <Input type="number" min="2000" max="2100" value={form.year} onChange={e=>setForm(s=>({...s, year:Number(e.target.value)||new Date().getFullYear()}))} />
            <select className="rounded-xl border p-2" value={form.serviceLevel} onChange={e=>setForm(s=>({...s, serviceLevel:e.target.value}))}>
              {['Clarity','On Demand','Elevate'].map(x=> <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="rounded-xl border p-2" value={form.risk} onChange={e=>setForm(s=>({...s, risk:e.target.value}))}>
              {['Low','Medium','High'].map(x=> <option key={x} value={x}>{x}</option>)}
            </select>
            <div className="sm:col-span-6 flex gap-2">
              {!editingId ? (
                <Button type="submit">Add Client</Button>
              ) : (
                <>
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="secondary" onClick={()=>setEditingId(null)}>Cancel</Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Years</th>
              <th className="px-4 py-3">Service / Risk</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (<tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No clients yet.</td></tr>)}
            {filtered.map(c => (
              <tr key={c.id} className="border-t align-top">
                <td className="px-4 py-3">{c.group || '—'}</td>
                <td className="px-4 py-3">{c.client || '—'}</td>
                <td className="px-4 py-3">{c.entity || 'Individual'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(c.years || []).map(y => <span key={y} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{y}</span>)}
                    <YearAdder onAdd={(y)=>addYear(c.id, y)} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-gray-700">
                    <div>Service: {(c.serviceLevelByYear && c.years?.length && c.serviceLevelByYear[c.years[0]]) || c.serviceLevel || 'Clarity'}</div>
                    <div>Risk: {c.risk || 'Low'}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={()=>startEdit(c)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={()=>removeClientRow(c.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function YearAdder({ onAdd }){
  const [val, setVal] = useState('')
  return (
    <form onSubmit={e=>{e.preventDefault(); if(!val) return; onAdd(Number(val)); setVal('')}} className="flex items-center gap-2">
      <Input type="number" min="2000" max="2100" value={val} onChange={e=>setVal(e.target.value)} className="w-24" placeholder="Year" />
      <Button type="submit" variant="outline" size="sm">+ Year</Button>
    </form>
  )
}
