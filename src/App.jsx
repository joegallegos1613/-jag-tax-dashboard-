// src/App.jsx — Supabase-driven with Owners Board + Owners Admin + ownerId single source of truth
import React, { useEffect, useMemo, useState, useTransition } from 'react'
import './index.css'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert } from '@/components/ui/alert'
import { Search, Trash2 } from 'lucide-react'
import OwnersBoard from '@/components/OwnersBoard'
import OwnersAdmin from '@/components/OwnersAdmin'

import {
  loadClientsFromServer,
  subscribe as subscribeClients,
  getClients,
  addClientRow,
  updateClientRow,
  removeClientRow,
} from '@/store/clientsStore'

import {
  loadOwnersFromServer,
  subscribeOwners,
  getOwners,
} from '@/store/ownersStore'

const SERVICE_LEVELS = ['Clarity', 'On Demand', 'Elevate']
const PAYMENT_STATUSES = ['Pending', 'Sent', 'Paid']
const DELIVERABLE_TYPES = ['Estimate', 'Info Request', 'Meeting', 'Payment Request', 'Projection', 'Return Sent', 'Strategy Memo', 'Invoice', 'CCT']
const DELIVERABLE_STATUSES = ['Planned', 'Requested', 'Sent', 'Completed']

function today() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${yyyy}-${mm}-${dd}`
}
function yearOf(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const m = /^(\d{4})-/.exec(dateStr.trim())
  return m ? Number(m[1]) : null
}

function kpisFromDeliverablesForYear(c, taxYear) {
  const list = (c.deliverables || []).filter(d => {
    const y = d.taxYear ?? yearOf(d.date) ?? c.year ?? null
    return Number(y) === Number(taxYear)
  })
  const estimatesSent = list.filter(d => d.type === 'Estimate' && (d.status === 'Sent' || d.status === 'Completed')).length
  const meetingsHeld   = list.filter(d => d.type === 'Meeting'  && d.status === 'Completed').length
  const requestsSent   = list.filter(d => d.type === 'Info Request' && (d.status === 'Requested' || d.status === 'Sent' || d.status === 'Completed')).length
  return { estimatesSent, meetingsHeld, requestsSent }
}
function requiredMeetings(serviceLevel) {
  if (serviceLevel === 'Clarity') return 1
  if (serviceLevel === 'Elevate') return 2
  return 0
}
function getAlertsForYear(c, taxYear) {
  const { estimatesSent, meetingsHeld } = kpisFromDeliverablesForYear(c, taxYear)
  const alerts = []
  if (estimatesSent === 0) alerts.push({ id: 'no-estimates', level: 'error', text: 'No estimates communicated' })
  const sl = getServiceLevel(c, taxYear)
  const need = requiredMeetings(sl)
  if (meetingsHeld < need) alerts.push({ id: 'meeting-min', level: 'warn', text: `Meetings below minimum (${meetingsHeld}/${need}) for ${sl}` })
  return alerts
}
function totalPaidForYear(clientLike, taxYear) {
  const list = clientLike.paymentRequests || []
  return list.reduce((sum, p) => {
    if (p.status !== 'Paid') return sum
    const y = p.taxYear ?? yearOf(p.requestDate) ?? clientLike.year ?? null
    return Number(y) === Number(taxYear) ? sum + (p.amount || 0) : sum
  }, 0)
}
function getSafeHarbor(clientLike, taxYear) {
  const map = clientLike.safeHarborByYear || {}
  const val = map[taxYear]
  if (typeof val === 'number') return val
  return typeof clientLike.safeHarbor === 'number' ? clientLike.safeHarbor : 0
}
function setSafeHarborForYearObj(c, taxYear, val) {
  const nextMap = { ...(c.safeHarborByYear || {}) , [taxYear]: val }
  const legacy = Number(c.year) === Number(taxYear) ? val : (c.safeHarbor ?? 0)
  return { ...c, safeHarborByYear: nextMap, safeHarbor: legacy }
}
function getServiceLevel(clientLike, taxYear) {
  const map = clientLike.serviceLevelByYear || {}
  return map[taxYear] || clientLike.serviceLevel || 'Clarity'
}
function setServiceLevelForYearObj(c, taxYear, level) {
  const next = { ...(c.serviceLevelByYear || {}) }
  next[taxYear] = level
  const legacy = Number(c.year) === Number(taxYear) ? level : (c.serviceLevel || 'Clarity')
  return { ...c, serviceLevelByYear: next, serviceLevel: legacy }
}
function riskForClientYear(c, taxYear) {
  const alerts = getAlertsForYear(c, taxYear)
  const safeHarbor = getSafeHarbor(c, taxYear) || 0
  const paid = totalPaidForYear(c, taxYear)
  const quarters = (c.paymentRequests || []).filter(p => (p.taxYear ?? yearOf(p.requestDate) ?? c.year) === taxYear)
  const activeRq = quarters.filter(p => ['Sent','Requested'].includes(p.status)).length

  let level = 'Low'
  const hasMeetWarn = alerts.some(a => a.id === 'meeting-min')
  const hasNoEst = alerts.some(a => a.id === 'no-estimates')

  if (hasMeetWarn) level = 'Medium'
  if (hasMeetWarn && hasNoEst) level = 'High'
  if (safeHarbor > 0 && paid < 0.5 * safeHarbor && activeRq >= 2) {
    level = (level === 'Low') ? 'Medium' : 'High'
  }
  return level
}
function expandRows(clients) {
  const rows = []
  for (const c of clients) {
    let years = c.years || (c.year ? [Number(c.year)] : [])
    if (!years || years.length === 0) years = [new Date().getFullYear()]
    for (const y of years) rows.push({ ...c, rowYear: Number(y), rowId: `${c.id}__${y}` })
  }
  rows.sort((a, b) => (b.rowYear || 0) - (a.rowYear || 0))
  return rows
}

export default function App(){
  const [clients, setClients] = useState([])
  const [owners, setOwners] = useState([])

  const [view, setView] = useState('dashboard') // 'dashboard' | 'ownersBoard' | 'ownersAdmin'
  const [yearFilter, setYearFilter] = useState('All')
  const [risk, setRisk] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let unsubC = () => {}
    let unsubO = () => {}
    ;(async () => {
      await loadClientsFromServer()
      await loadOwnersFromServer()
      setClients(getClients())
      setOwners(getOwners())
      unsubC = subscribeClients(setClients)
      unsubO = subscribeOwners(setOwners)
    })()
    return () => { unsubC(); unsubO() }
  }, [])

  const expandedRows = useMemo(() => expandRows(clients), [clients])

  const filtered = useMemo(() => {
    return expandedRows.filter(r =>
      (yearFilter === 'All' || Number(r.rowYear) === Number(yearFilter)) &&
      (risk === 'All' || riskForClientYear(r, r.rowYear) === risk) &&
      (query.length < 2 || [r.group, r.client, r.entity].join(' ').toLowerCase().includes(query.toLowerCase()))
    )
  }, [expandedRows, yearFilter, risk, query])

  useEffect(() => {
    if (!selectedClient) return
    const hasRow = expandedRows.find(r => r.id === selectedClient.id && r.rowYear === selectedYear)
    if (!hasRow) {
      const fallback = selectedClient.year || (selectedClient.years?.[0])
      setSelectedYear(Number(fallback || new Date().getFullYear()))
    }
  }, [selectedClient, expandedRows, selectedYear])

  const selectedClientFresh = useMemo(() => {
    if (!selectedClient) return null
    return clients.find(c => c.id === selectedClient.id) || selectedClient
  }, [clients, selectedClient])

  function patchClient(clientId, producer){
    setClients(prev => {
      const next = prev.map(c => {
        if (c.id !== clientId) return c
        const updated = producer(c)
        updateClientRow(clientId, updated) // push to Supabase
        return updated
      })
      return next
    })
  }

  function addClient(){
    const group = prompt('Client/Group name (e.g., Riverstone Ventures LLC):'); if (!group) return
    const entity = prompt('Entity (Individual / S Corp / Partnership / C Corp):','Individual') || 'Individual'
    const y = Number(prompt('Tax Year:', String(new Date().getFullYear())) || new Date().getFullYear())
    const serviceLevel = prompt('Service Level (Clarity / On Demand / Elevate):','Clarity') || 'Clarity'
    const payload = {
      group, client: '', entity,
      year: y, years: [y],
      serviceLevel, serviceLevelByYear: { [y]: serviceLevel },
      risk: 'Low',
      safeHarbor: 0, safeHarborByYear: { [y]: 0 },
      deliverablesProgress: 0,
      strategies: [], deliverables: [],
      estimateOwnerId: null, meetingOwnerId: null, requestOwnerId: null,
      paymentRequests: [
        { quarter: 'Q1', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Q2', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y },
        { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', ownerId: null, taxYear: y }
      ]
    }
    addClientRow(payload)
  }

  function deleteClient(clientId){
    if (!confirm('Delete this client?')) return
    removeClientRow(clientId)
    setSelectedClient(null)
  }

  function drillToClientYear(clientId, year){
    const target = clients.find(c => c.id === clientId); if (!target) return
    setSelectedClient(target); setSelectedYear(year); setView('dashboard')
  }

  function commitSafeHarbor(){
    if (!selectedClientFresh) return
    const val = Number(prompt('Safe Harbor ($):', String(getSafeHarbor(selectedClientFresh, selectedYear) || 0)) || 0)
    if (!Number.isFinite(val)) return
    patchClient(selectedClientFresh.id, (c) => setSafeHarborForYearObj(c, selectedYear, val))
  }

  function commitServiceLevel(level){
    if (!selectedClientFresh) return
    patchClient(selectedClientFresh.id, (c) => setServiceLevelForYearObj(c, selectedYear, level))
  }

  function addOrUpdatePayment(c){
    let quarter = prompt('Quarter (Q1, Q2, Q3, Q4, Extension):','Q1'); if (!quarter) return
    const allowed = ['Q1','Q2','Q3','Q4','Extension']; if (!allowed.includes(quarter)) return
    const requestDate = prompt('Request date (YYYY-MM-DD):', today()) || today()
    const amount = Number(prompt('Amount:', '0') || 0)
    const status = prompt('Status (Pending / Sent / Paid):','Pending') || 'Pending'
    const ownerId = owners[0]?.id ?? null
    const taxYear = Number(selectedYear || c.year || new Date().getFullYear())

    patchClient(c.id, (curr) => {
      const base = (curr.paymentRequests || [])
      const ensureExt = arr => arr.some(p => p.quarter === 'Extension') ? arr : [...arr, { quarter:'Extension', requestDate:null, amount:null, status:'Pending', ownerId:null, taxYear }]
      const list = ensureExt(base).map(p => p.quarter === quarter ? { quarter, requestDate, amount, status, ownerId, taxYear } : p)
      if (!list.some(p => p.quarter === quarter)){
        list.push({ quarter, requestDate, amount, status, ownerId, taxYear })
      }
      return { ...curr, paymentRequests: list }
    })
  }

  function updatePaymentStatus(clientId, quarter, newStatus){
    patchClient(clientId, (c) => {
      const list = (c.paymentRequests || []).map(p => p.quarter === quarter ? { ...p, status: newStatus } : p)
      return { ...c, paymentRequests: list }
    })
  }

  function addDeliverable(c, preset){
    const taxYear = Number(selectedYear || c.year || new Date().getFullYear())
    const type = preset?.type || prompt(`Type (${DELIVERABLE_TYPES.join(' / ')}):`, 'Estimate') || 'Estimate'
    const date = preset?.date || prompt('Date (YYYY-MM-DD):', today()) || today()
    const ownerId = preset?.ownerId ?? owners[0]?.id ?? null
    const status = preset?.status || prompt(`Status (${DELIVERABLE_STATUSES.join(' / ')}):`, 'Planned') || 'Planned'
    const notes = preset?.notes ?? (prompt('Notes (optional):', '') || '')
    const item = { id: String(Date.now()), type, date, ownerId, status, notes, taxYear }
    patchClient(c.id, (curr) => ({ ...curr, deliverables: [item, ...(curr.deliverables || [])] }))
  }

  function deleteDeliverable(clientId, deliverableId){
    patchClient(clientId, (c) => ({ ...c, deliverables: (c.deliverables || []).filter(d => d.id !== deliverableId) }))
  }

  function updateDeliverable(clientId, deliverableId, patch){
    patchClient(clientId, (c) => {
      const deliverables = (c.deliverables || []).map(d => {
        if (d.id !== deliverableId) return d
        const stableTaxYear = d.taxYear ?? selectedYear ?? c.year
        return { ...d, ...patch, taxYear: stableTaxYear }
      })
      return { ...c, deliverables }
    })
  }

  const ownerById = useMemo(() => new Map(owners.map(o => [o.id, o])), [owners])
  const getOwnerName = (ownerId) => ownerId ? (ownerById.get(ownerId)?.name || 'Unknown') : 'Unassigned'

  return (
    <div className="p-0 font-sans max-w-7xl mx-auto">
      <div className="app-hero px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">JAG — Client-Level Tax Planning</h1>
          {isPending && <span className="text-xs opacity-60">Updating…</span>}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            <Button variant={view==='dashboard'?'default':'outline'} onClick={()=>setView('dashboard')}>Main</Button>
            <Button variant={view==='ownersBoard'?'default':'outline'} onClick={()=>setView('ownersBoard')}>Owners Board</Button>
            <Button variant={view==='ownersAdmin'?'default':'outline'} onClick={()=>setView('ownersAdmin')}>Owners Admin</Button>
          </div>

          {view === 'dashboard' && !selectedClientFresh && (
            <>
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input placeholder="Search client or entity..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              <select className="border rounded-xl px-3 py-2 bg-white" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} disabled={!!selectedClientFresh}>
                <option value="All">All Tax Years</option>
                {[...new Set(expandedRows.map(r => r.rowYear))].sort((a,b)=>a-b).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select className="border rounded-xl px-3 py-2 bg-white" value={risk} onChange={(e) => setRisk(e.target.value)} disabled={!!selectedClientFresh}>
                {['All','Low','Medium','High'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              {!selectedClientFresh && <Button onClick={addClient}>+ Add Client</Button>}
              {selectedClientFresh && (
                <>
                  <Button className="btn-soft" onClick={() => { setSelectedClient(null); setSelectedYear(null) }}>← Back to Dashboard</Button>
                  <Button className="btn-soft" onClick={() => deleteClient(selectedClientFresh.id)} title="Delete client">🗑 Delete Client</Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {view === 'ownersBoard' && (
        <OwnersBoard owners={owners} clients={clients} onDrill={drillToClientYear} />
      )}

      {view === 'ownersAdmin' && (
        <OwnersAdmin />
      )}

      {view === 'dashboard' && (
        <>
          {!selectedClientFresh && (
            <div className="px-6 -mt-6">
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-12 text-xs text-gray-500 font-medium border-b pb-2">
                    <div className="col-span-2">Client</div>
                    <div className="col-span-1">Tax Year</div>
                    <div className="col-span-1">Entity</div>
                    <div className="col-span-1">Service Level</div>
                    <div className="col-span-1">Risk</div>
                    <div className="col-span-1">Safe Harbor</div>
                    <div className="col-span-1">Estimates Sent</div>
                    <div className="col-span-1">Meetings Held</div>
                    <div className="col-span-1">Requests Sent</div>
                    <div className="col-span-1">YTD Paid</div>
                    <div className="col-span-1 text-right pr-2">Actions</div>
                  </div>

                  {filtered.map((r) => {
                    const { estimatesSent, meetingsHeld, requestsSent } = kpisFromDeliverablesForYear(r, r.rowYear)
                    const alerts = getAlertsForYear(r, r.rowYear)
                    const rowTone = alerts.some(a => a.level === 'error') ? 'bg-red-50' : alerts.some(a => a.level === 'warn') ? 'bg-amber-50' : 'bg-white'
                    const ytdPaid = totalPaidForYear(r, r.rowYear)
                    const safeHarborVal = getSafeHarbor(r, r.rowYear)
                    const displayRisk = riskForClientYear(r, r.rowYear)
                    const sl = getServiceLevel(r, r.rowYear)
                    return (
                      <div
                        key={r.rowId}
                        className={`grid grid-cols-12 items-center border-b py-2 text-sm hover:bg-gray-50 rounded-lg ${rowTone}`}
                      >
                        <div className="col-span-2 font-medium cursor-pointer" onClick={() => { setSelectedClient(r); setSelectedYear(r.rowYear); }}>
                          {r.group}
                        </div>
                        <div className="col-span-1 text-gray-700 cursor-pointer" onClick={() => { setSelectedClient(r); setSelectedYear(r.rowYear); }}>{r.rowYear}</div>
                        <div className="col-span-1 text-gray-600 cursor-pointer" onClick={() => { setSelectedClient(r); setSelectedYear(r.rowYear); }}>{r.entity}</div>
                        <div className="col-span-1 text-gray-600 cursor-pointer" onClick={() => { setSelectedClient(r); setSelectedYear(r.rowYear); }}>{sl}</div>
                        <div className="col-span-1">
                          <Badge className={displayRisk === 'High' ? 'pill-err' : displayRisk === 'Medium' ? 'pill-warn' : 'pill-okay'}>
                            {displayRisk}
                          </Badge>
                        </div>
                        <div className="col-span-1">${(safeHarborVal ?? 0).toLocaleString()}</div>
                        <div className="col-span-1 text-center">{estimatesSent}</div>
                        <div className="col-span-1 text-center">{meetingsHeld}</div>
                        <div className="col-span-1 text-center">{requestsSent}</div>
                        <div className="col-span-1 text-center font-semibold">${ytdPaid.toLocaleString()}</div>
                        <div className="col-span-1 flex justify-end pr-2">
                          <button
                            className="rounded-md px-2 py-1 hover:bg-red-50 border border-transparent hover:border-red-200 inline-flex items-center justify-center"
                            title="Delete client"
                            onClick={(e) => { e.stopPropagation(); deleteClient(r.id) }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {selectedClientFresh && (() => {
            const alerts = getAlertsForYear(selectedClientFresh, selectedYear)
            const tone = alerts.some(a => a.level === 'error') ? 'err' : alerts.some(a => a.level === 'warn') ? 'warn' : 'ok'
            const title = tone === 'err' ? 'Issues detected' : tone === 'warn' ? 'Action recommended' : 'All good'

            const { estimatesSent, meetingsHeld, requestsSent } = kpisFromDeliverablesForYear(selectedClientFresh, selectedYear)

            const paymentsForYear = (selectedClientFresh.paymentRequests || []).filter(p => {
              const y = p.taxYear ?? yearOf(p.requestDate) ?? selectedClientFresh.year ?? null
              return Number(y) === Number(selectedYear)
            })

            const deliverablesForYear = (selectedClientFresh.deliverables || []).filter(d => {
              const y = d.taxYear ?? yearOf(d.date) ?? selectedClientFresh.year ?? null
              return Number(y) === Number(selectedYear)
            })

            const safeHarborForYear = getSafeHarbor(selectedClientFresh, selectedYear)

            return (
              <div className="px-6 mt-6 space-y-4">
                <div className="text-sm text-gray-500">
                  Editing for <span className="font-semibold">{selectedClientFresh.group}</span> · <span className="font-semibold">Tax Year {selectedYear}</span>
                </div>

                <Alert tone={tone} title={title}>
                  {alerts.length === 0 ? 'Client is meeting baseline targets.' : (
                    <ul className="list-disc ml-5">
                      {alerts.map(a => <li key={a.id}>{a.text}</li>)}
                    </ul>
                  )}
                </Alert>

                <Card>
                  <CardContent className="flex flex-wrap gap-3 items-center">
                    <div className="text-sm text-gray-600">
                      Safe Harbor Target ($):
                      <Button className="ml-2" variant="outline" onClick={commitSafeHarbor}>Edit</Button>
                      <span className="ml-2 text-xs opacity-60">
                        Canonical: {(safeHarborForYear ?? 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600">Service Level:
                      <select
                        className="border rounded-xl px-2 py-1 ml-2 bg-white"
                        value={getServiceLevel(selectedClientFresh, selectedYear)}
                        onChange={(e) => commitServiceLevel(e.target.value)}
                      >
                        {SERVICE_LEVELS.map(sl => <option key={sl} value={sl}>{sl}</option>)}
                      </select>
                    </div>

                    <div className="text-sm text-gray-600">Estimates Sent: <span className="font-semibold">{estimatesSent}</span></div>
                    <Button
                      className="btn-soft"
                      onClick={() =>
                        addDeliverable(selectedClientFresh, {
                          type: 'Estimate',
                          status: 'Sent',
                          ownerId: owners[0]?.id ?? null,
                          date: today(),
                          notes: 'Estimate sent'
                        })
                      }
                    >
                      + Estimate
                    </Button>

                    <div className="text-sm text-gray-600">Meetings Held: <span className="font-semibold">{meetingsHeld}</span></div>
                    <Button
                      className="btn-soft"
                      onClick={() =>
                        addDeliverable(selectedClientFresh, {
                          type: 'Meeting',
                          status: 'Completed',
                          ownerId: owners[0]?.id ?? null,
                          date: today(),
                          notes: 'Planning meeting'
                        })
                      }
                    >
                      + Meeting
                    </Button>

                    <div className="text-sm text-gray-600">Requests Sent: <span className="font-semibold">{requestsSent}</span></div>
                    <Button
                      className="btn-soft"
                      onClick={() =>
                        addDeliverable(selectedClientFresh, {
                          type: 'Info Request',
                          status: 'Requested',
                          ownerId: owners[0]?.id ?? null,
                          date: today(),
                          notes: 'Docs requested'
                        })
                      }
                    >
                      + Info Request
                    </Button>

                    <div className="ml-auto text-sm text-gray-600">
                      YTD Paid: <span className="font-semibold">${totalPaidForYear(selectedClientFresh, selectedYear).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="payments">
                  <TabsList className="mt-2">
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                    <TabsTrigger value="strategies">Strategies</TabsTrigger>
                  </TabsList>

                  <TabsContent value="payments" className="mt-2 text-sm text-gray-700 space-y-3">
                    <div className="flex gap-2">
                      <Button className="btn-soft" onClick={() => addOrUpdatePayment(selectedClientFresh)}>+ Add/Update Payment</Button>
                    </div>
                    <div className="grid md:grid-cols-5 gap-3">
                      {paymentsForYear.map((p, i) => {
                        const name = getOwnerName(p.ownerId)
                        return (
                          <Card key={i} className="rounded-xl p-3 text-sm">
                            <div className="font-semibold">{p.quarter}</div>
                            <div className="text-gray-600">Requested: {p.requestDate || '—'}</div>
                            <div className="text-gray-600">Amount: {p.amount ? `$${p.amount.toLocaleString()}` : '—'}</div>
                            <div className="flex items-center gap-2">
                              <span>Status:</span>
                              <select
                                className="border rounded-lg px-2 py-1 bg-white"
                                value={p.status || 'Pending'}
                                onChange={(e) => updatePaymentStatus(selectedClientFresh.id, p.quarter, e.target.value)}
                              >
                                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div className="text-gray-600">Owner: {name}</div>
                            <div className="text-gray-400 text-xs">Tax Year: {p.taxYear ?? (yearOf(p.requestDate) ?? selectedClientFresh.year)}</div>
                          </Card>
                        )
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="deliverables" className="mt-2 text-sm text-gray-700 space-y-2">
                    <div className="flex gap-2">
                      <Button className="btn-soft" onClick={() => addDeliverable(selectedClientFresh)}>+ Add Deliverable</Button>
                      <Button className="btn-soft" onClick={() => addDeliverable(selectedClientFresh, { type: 'Estimate', status: 'Sent', ownerId: owners[0]?.id ?? null, date: today(), notes: 'Estimate sent' })}>+ Quick Estimate</Button>
                      <Button className="btn-soft" onClick={() => addDeliverable(selectedClientFresh, { type: 'Meeting', status: 'Completed', ownerId: owners[0]?.id ?? null, date: today(), notes: 'Meeting held' })}>+ Quick Meeting</Button>
                      <Button className="btn-soft" onClick={() => addDeliverable(selectedClientFresh, { type: 'Info Request', status: 'Requested', ownerId: owners[0]?.id ?? null, date: today(), notes: 'Docs requested' })}>+ Quick Request</Button>
                    </div>

                    {(deliverablesForYear.length ?? 0) === 0 && <p className="text-gray-600">No deliverables for {selectedYear} yet.</p>}

                    <div className="overflow-auto">
                      <table className="table-base w-full text-sm border rounded-xl overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 border">Type</th>
                            <th className="text-left p-2 border">Date</th>
                            <th className="text-left p-2 border">Owner</th>
                            <th className="text-left p-2 border">Status</th>
                            <th className="text-left p-2 border">Notes</th>
                            <th className="text-left p-2 border">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliverablesForYear.map((d) => (
                            <tr key={d.id} className="align-top">
                              <td className="p-2 border">
                                <select className="border rounded-lg px-2 py-1 bg-white" value={d.type} onChange={(e) => updateDeliverable(selectedClientFresh.id, d.id, { type: e.target.value })}>
                                  {DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="p-2 border">
                                <input
                                  type="date"
                                  className="border rounded-lg px-2 py-1"
                                  value={d.date || ''}
                                  onChange={(e) => updateDeliverable(selectedClientFresh.id, d.id, { date: e.target.value })}
                                />
                                <div className="text-[10px] text-gray-400 mt-0.5">Tax Year: {d.taxYear ?? (yearOf(d.date) ?? selectedClientFresh.year)}</div>
                              </td>
                              <td className="p-2 border">
                                <select
                                  className="border rounded-lg px-2 py-1 bg-white w-full"
                                  value={d.ownerId ?? ''}
                                  onChange={(e) => updateDeliverable(selectedClientFresh.id, d.id, { ownerId: e.target.value || null })}
                                >
                                  <option value="">Unassigned</option>
                                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                                <div className="text-[10px] text-gray-400 mt-0.5">{getOwnerName(d.ownerId)}</div>
                              </td>
                              <td className="p-2 border">
                                <select className="border rounded-lg px-2 py-1 bg-white" value={d.status} onChange={(e) => updateDeliverable(selectedClientFresh.id, d.id, { status: e.target.value })}>
                                  {DELIVERABLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="p-2 border">
                                <input type="text" className="border rounded-lg px-2 py-1 w-full" value={d.notes || ''} onChange={(e) => updateDeliverable(selectedClientFresh.id, d.id, { notes: e.target.value })} placeholder="Notes" />
                              </td>
                              <td className="p-2 border">
                                <button className="btn-soft px-2 py-1 rounded-lg" title="Delete" onClick={() => deleteDeliverable(selectedClientFresh.id, d.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-1 mt-3">
                      <div className="text-xs text-gray-500">Overall progress</div>
                      <Progress value={selectedClientFresh.deliverablesProgress} />
                    </div>
                  </TabsContent>

                  <TabsContent value="strategies" className="mt-2 text-sm text-gray-700 space-y-3">
                    {(selectedClientFresh.strategies?.length ?? 0) === 0 && <p className="text-gray-600">No strategies listed yet.</p>}
                    <ul className="list-disc ml-5 space-y-1">
                      {selectedClientFresh.strategies?.map((s, i) => (
                        <li key={i}><span className="text-gray-500 mr-2">[{s.date}]</span>{s.note}</li>
                      ))}
                    </ul>
                    <Button className="btn-soft" onClick={() => {
                      const note = prompt('Strategy note:'); if (!note) return
                      const item = { note, date: today() }
                      patchClient(selectedClientFresh.id, (c) => ({ ...c, strategies: [item, ...(c.strategies || [])] }))
                    }}>Add Strategy</Button>
                  </TabsContent>
                </Tabs>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
