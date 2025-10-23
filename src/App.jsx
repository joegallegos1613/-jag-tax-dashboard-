import React, { useEffect, useMemo, useState } from 'react'
import './index.css'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert } from '@/components/ui/alert'
import { Search, CheckCircle2, Trash2 } from 'lucide-react'

const SERVICE_LEVELS = ['Clarity', 'On Demand', 'Elevate']
const PAYMENT_STATUSES = ['Pending', 'Sent', 'Paid']
const DELIVERABLE_TYPES = ['Estimate', 'Info Request', 'Meeting', 'Payment Request', 'Projection', 'Return Sent', 'Strategy Memo']
const DELIVERABLE_STATUSES = ['Planned', 'Requested', 'Sent', 'Completed']

const DEFAULT_CLIENTS = [
  {
    id: '700019-1',
    group: 'CB Direct, LLC',
    client: 'Michael Cain',
    entity: 'Individual',
    serviceLevel: 'Elevate',
    risk: 'High',
    status: 'Active',
    year: 2024,
    safeHarbor: 65000,
    deliverablesProgress: 75,
    estimateOwner: 'Averey',
    meetingOwner: 'Joe',
    requestOwner: 'Hector',
    strategies: [],
    deliverables: [
      { id: 'd1', type: 'Estimate', date: '2024-03-10', owner: 'Averey', status: 'Sent', notes: 'Q1 SH estimate emailed' },
      { id: 'd2', type: 'Meeting', date: '2024-06-15', owner: 'Joe', status: 'Completed', notes: 'Mid-year planning' },
      { id: 'd3', type: 'Info Request', date: '2024-09-10', owner: 'Hector', status: 'Requested', notes: 'Q3 docs' }
    ],
    paymentRequests: [
      { quarter: 'Q1', requestDate: '2024-03-10', amount: 12000, status: 'Paid', owner: 'Averey' },
      { quarter: 'Q2', requestDate: '2024-06-10', amount: 14000, status: 'Paid', owner: 'Joe' },
      { quarter: 'Q3', requestDate: '2024-09-10', amount: 16000, status: 'Pending', owner: 'Hector' },
      { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null }
    ]
  }
]

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`
}

// ---- Derivations from Deliverables (single source of truth) ----
function kpisFromDeliverables(c) {
  const list = c.deliverables || []
  const estimatesSent = list.filter(d => d.type === 'Estimate' && (d.status === 'Sent' || d.status === 'Completed')).length
  const meetingsHeld = list.filter(d => d.type === 'Meeting' && d.status === 'Completed').length
  const requestsSent = list.filter(d => d.type === 'Info Request' && (d.status === 'Requested' || d.status === 'Sent' || d.status === 'Completed')).length
  return { estimatesSent, meetingsHeld, requestsSent }
}

function requiredMeetings(serviceLevel) {
  if (serviceLevel === 'Clarity') return 1
  if (serviceLevel === 'Elevate') return 2
  return 0
}

function getAlerts(c) {
  const { estimatesSent, meetingsHeld } = kpisFromDeliverables(c)
  const alerts = []
  if (estimatesSent === 0) {
    alerts.push({ id: 'no-estimates', level: 'error', text: 'No estimates communicated' })
  }
  const need = requiredMeetings(c.serviceLevel)
  if (meetingsHeld < need) {
    alerts.push({ id: 'meeting-min', level: 'warn', text: `Meetings below minimum (${meetingsHeld}/${need}) for ${c.serviceLevel}` })
  }
  return alerts
}

export default function TaxPlanningDashboard() {
  const [clients, setClients] = useState(() => {
    try {
      const saved = localStorage.getItem('jag_clients')
      return saved ? JSON.parse(saved) : DEFAULT_CLIENTS
    } catch { return DEFAULT_CLIENTS }
  })
  useEffect(() => { localStorage.setItem('jag_clients', JSON.stringify(clients)) }, [clients])

  const [year, setYear] = useState('2024')
  const [risk, setRisk] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)

  useEffect(() => {
    if (!selectedClient) return
    const updated = clients.find(c => c.id === selectedClient.id)
    if (updated) setSelectedClient(updated)
  }, [clients])

  // ------- CRUD helpers -------
  function addClient() {
    const group = prompt('Client/Group name (e.g., CB Direct, LLC):'); if (!group) return
    const client = prompt('Primary contact (e.g., Michael Cain):') || ''
    const entity = prompt('Entity type (Individual / S Corp / Partnership / C Corp):') || 'Individual'
    const serviceLevel = prompt('Service Level (Clarity / On Demand / Elevate):') || 'Clarity'
    const id = `${Date.now()}`
    const newClient = {
      id, group, client, entity, serviceLevel, risk: 'Low', status: 'Active', year: Number(new Date().getFullYear()),
      safeHarbor: 0, deliverablesProgress: 0, strategies: [], deliverables: [],
      estimateOwner: '', meetingOwner: '', requestOwner: '',
      paymentRequests: [
        { quarter: 'Q1', requestDate: null, amount: null, status: 'Pending', owner: null },
        { quarter: 'Q2', requestDate: null, amount: null, status: 'Pending', owner: null },
        { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', owner: null },
        { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null },
      ]
    }
    setClients(prev => [newClient, ...prev])
    setSelectedClient(newClient)
  }

  function addOrUpdatePayment(c) {
    const quarter = prompt('Quarter to add/update (Q1, Q2, Q3, Q4):');
    if (!quarter || !['Q1','Q2','Q3','Q4'].includes(quarter)) return alert('Please enter Q1/Q2/Q3/Q4')
    const requestDate = prompt('Request date (YYYY-MM-DD):', today())
    const amount = Number(prompt('Amount (just numbers):', '0') || 0)
    const status = prompt('Status (Pending / Sent / Paid):', 'Pending') || 'Pending'
    const owner = prompt('Owner (name):', c?.requestOwner || '') || null

    setClients(prev => prev.map(pc => {
      if (pc.id !== c.id) return pc
      const paymentRequests = pc.paymentRequests.map(p => p.quarter === quarter ? { quarter, requestDate, amount, status, owner } : p)
      return { ...pc, paymentRequests }
    }))
  }

  function updatePaymentStatus(clientId, quarter, newStatus) {
    setClients(prev => prev.map(pc => {
      if (pc.id !== clientId) return pc
      const paymentRequests = pc.paymentRequests.map(p => p.quarter === quarter ? { ...p, status: newStatus } : p)
      return { ...pc, paymentRequests }
    }))
  }

  function updateServiceLevel(clientId, newLevel) {
    setClients(prev => prev.map(pc => pc.id === clientId ? { ...pc, serviceLevel: newLevel } : pc))
  }

  // Deliverables quick-adds (these directly add to the deliverables list)
  function addDeliverable(c, preset) {
    const type = preset?.type || prompt(`Type (${DELIVERABLE_TYPES.join(' / ')}):`, 'Estimate') || 'Estimate'
    const date = preset?.date || prompt('Date (YYYY-MM-DD):', today()) || today()
    const owner = preset?.owner || prompt('Owner:', 'Unassigned') || 'Unassigned'
    const status = preset?.status || prompt(`Status (${DELIVERABLE_STATUSES.join(' / ')}):`, 'Planned') || 'Planned'
    const notes = preset?.notes ?? (prompt('Notes (optional):', '') || '')
    const item = { id: `${Date.now()}`, type, date, owner, status, notes }

    setClients(prev => prev.map(pc => pc.id !== c.id ? pc : { ...pc, deliverables: [item, ...(pc.deliverables || [])] }))
  }

  function deleteDeliverable(clientId, deliverableId) {
    setClients(prev => prev.map(pc => pc.id !== clientId ? pc : { ...pc, deliverables: (pc.deliverables || []).filter(d => d.id !== deliverableId) }))
  }

  function updateDeliverable(clientId, deliverableId, patch) {
    setClients(prev => prev.map(pc => {
      if (pc.id !== clientId) return pc
      const deliverables = (pc.deliverables || []).map(d => d.id === deliverableId ? { ...d, ...patch } : d)
      return { ...pc, deliverables }
    }))
  }

  const filtered = useMemo(() => {
    return clients.filter(
      (c) =>
        (year === 'All' || c.year === Number(year)) &&
        (risk === 'All' || c.risk === risk) &&
        (query.length < 2 || [c.group, c.client, c.entity].join(' ').toLowerCase().includes(query.toLowerCase()))
    )
  }, [clients, year, risk, query])

  return (
    <div className="p-0 font-sans max-w-7xl mx-auto">
      {/* Gradient hero */}
      <div className="app-hero px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">JAG — Client‑Level Tax Planning</h1>
          <div className="flex gap-2">
            <Button onClick={addClient}>+ Add Client</Button>
          </div>
        </div>
        <div className="mt-4 flex gap-3 items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input placeholder="Search client or entity..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="border rounded-xl px-3 py-2 bg-white" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="All">All Years</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
          </select>
          <select className="border rounded-xl px-3 py-2 bg-white" value={risk} onChange={(e) => setRisk(e.target.value)}>
            {['All','Low','Medium','High'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 -mt-6">
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-10 text-xs text-gray-500 font-medium border-b pb-2">
              <div className="col-span-2">Client</div>
              <div className="col-span-1">Entity</div>
              <div className="col-span-1">Service Level</div>
              <div className="col-span-1">Risk</div>
              <div className="col-span-1">Safe Harbor</div>
              <div className="col-span-1">Estimates Sent</div>
              <div className="col-span-1">Meetings Held</div>
              <div className="col-span-1">Requests Sent</div>
              <div className="col-span-1">Total Paid (YTD)</div>
              <div className="col-span-1">Alerts</div>
            </div>
            {filtered.map((c) => {
              const { estimatesSent, meetingsHeld, requestsSent } = kpisFromDeliverables(c)
              const totalPaid = (c.paymentRequests || []).filter(p => p.status === 'Paid').reduce((s, p) => s + (p.amount || 0), 0)
              const alerts = getAlerts(c)
              const rowTone = alerts.some(a => a.level === 'error') ? 'bg-red-50' : alerts.some(a => a.level === 'warn') ? 'bg-amber-50' : 'bg-white'
              return (
                <div key={c.id} onClick={() => setSelectedClient(c)} className={`grid grid-cols-10 items-center border-b py-2 text-sm hover:bg-gray-50 cursor-pointer rounded-lg ${rowTone}`}>
                  <div className="col-span-2 font-medium">{c.group}</div>
                  <div className="col-span-1 text-gray-600">{c.entity}</div>
                  <div className="col-span-1 text-gray-600">{c.serviceLevel}</div>
                  <div className="col-span-1"><Badge className={c.risk === 'High' ? 'pill-err' : c.risk === 'Medium' ? 'pill-warn' : 'pill-okay'}>{c.risk}</Badge></div>
                  <div className="col-span-1">${c.safeHarbor?.toLocaleString?.() ?? c.safeHarbor}</div>
                  <div className="col-span-1 text-center">{estimatesSent}</div>
                  <div className="col-span-1 text-center">{meetingsHeld}</div>
                  <div className="col-span-1 text-center">{requestsSent}</div>
                  <div className="col-span-1 text-center font-semibold">${totalPaid.toLocaleString()}</div>
                  <div className="col-span-1 text-center">
                    {alerts.length === 0 ? (
                      <Badge className="pill-okay inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>OK</Badge>
                    ) : alerts.map(a => (
                      <Badge key={a.id} className={a.level === 'error' ? 'pill-err' : 'pill-warn'}>
                        {a.id === 'no-estimates' ? 'No Est.' : 'Meetings'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Detail */}
      {selectedClient && (() => {
        const alerts = getAlerts(selectedClient)
        const tone = alerts.some(a => a.level === 'error') ? 'err' : alerts.some(a => a.level === 'warn') ? 'warn' : 'ok'
        const title = tone === 'err' ? 'Issues detected' : tone === 'warn' ? 'Action recommended' : 'All good'
        const { estimatesSent, meetingsHeld, requestsSent } = kpisFromDeliverables(selectedClient)
        return (
          <div className="px-6 mt-6 space-y-4">
            <Alert tone={tone} title={title} actions={alerts.map(a => (
              a.id === 'no-estimates'
                ? <Button key={a.id} className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Estimate', status: 'Sent', owner: selectedClient.estimateOwner || 'Unassigned', date: today(), notes: 'Estimate sent' })}>Send Estimate</Button>
                : <Button key={a.id} className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Meeting', status: 'Completed', owner: selectedClient.meetingOwner || 'Unassigned', date: today(), notes: 'Meeting held' })}>Log Meeting</Button>
            ))}>
              {alerts.length === 0 ? 'Client is meeting baseline targets.' : (
                <ul className="list-disc ml-5">
                  {alerts.map(a => <li key={a.id}>{a.text}</li>)}
                </ul>
              )}
            </Alert>

            {/* KPI quick actions */}
            <Card>
              <CardContent className="flex flex-wrap gap-3 items-center">
                <div className="text-sm text-gray-600">Estimates Sent: <span className="font-semibold">{estimatesSent}</span></div>
                <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Estimate', status: 'Sent', owner: selectedClient.estimateOwner || 'Unassigned', date: today(), notes: 'Estimate sent' })}>+ Estimate</Button>
                <div className="text-sm text-gray-600">Meetings Held: <span className="font-semibold">{meetingsHeld}</span></div>
                <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Meeting', status: 'Completed', owner: selectedClient.meetingOwner || 'Unassigned', date: today(), notes: 'Planning meeting' })}>+ Meeting</Button>
                <div className="text-sm text-gray-600">Requests Sent: <span className="font-semibold">{requestsSent}</span></div>
                <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Info Request', status: 'Requested', owner: selectedClient.requestOwner || 'Unassigned', date: today(), notes: 'Docs requested' })}>+ Info Request</Button>
              </CardContent>
            </Card>

            {/* Service Level */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Service Level:</span>
                  <select className="border rounded-xl px-2 py-1 bg-white" value={selectedClient.serviceLevel} onChange={(e) => updateServiceLevel(selectedClient.id, e.target.value)}>
                    {SERVICE_LEVELS.map(sl => <option key={sl} value={sl}>{sl}</option>)}
                  </select>
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
                  <Button className="btn-soft" onClick={() => addOrUpdatePayment(selectedClient)}>+ Add/Update Payment</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-3">
                  {selectedClient.paymentRequests.map((p, i) => (
                    <Card key={i} className="rounded-xl p-3 text-sm">
                      <div className="font-semibold">{p.quarter}</div>
                      <div className="text-gray-600">Requested: {p.requestDate || '—'}</div>
                      <div className="text-gray-600">Amount: {p.amount ? `$${p.amount.toLocaleString()}` : '—'}</div>
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <select className="border rounded-lg px-2 py-1 bg-white" value={p.status || 'Pending'} onChange={(e) => updatePaymentStatus(selectedClient.id, p.quarter, e.target.value)}>
                          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="text-gray-600">Owner: {p.owner || 'Unassigned'}</div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="deliverables" className="mt-2 text-sm text-gray-700 space-y-2">
                <div className="flex gap-2">
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient)}>+ Add Deliverable</Button>
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Estimate', status: 'Sent', owner: selectedClient.estimateOwner || 'Unassigned', date: today(), notes: 'Estimate sent' })}>+ Quick Estimate</Button>
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Meeting', status: 'Completed', owner: selectedClient.meetingOwner || 'Unassigned', date: today(), notes: 'Meeting held' })}>+ Quick Meeting</Button>
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Info Request', status: 'Requested', owner: selectedClient.requestOwner || 'Unassigned', date: today(), notes: 'Docs requested' })}>+ Quick Request</Button>
                </div>

                {(selectedClient.deliverables?.length ?? 0) === 0 && <p className="text-gray-600">No deliverables yet.</p>}

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
                      {selectedClient.deliverables?.map((d) => (
                        <tr key={d.id} className="align-top">
                          <td className="p-2 border">
                            <select className="border rounded-lg px-2 py-1 bg-white" value={d.type} onChange={(e) => updateDeliverable(selectedClient.id, d.id, { type: e.target.value })}>
                              {DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="p-2 border">
                            <input type="date" className="border rounded-lg px-2 py-1" value={d.date || ''} onChange={(e) => updateDeliverable(selectedClient.id, d.id, { date: e.target.value })} />
                          </td>
                          <td className="p-2 border">
                            <input type="text" className="border rounded-lg px-2 py-1 w-full" value={d.owner || ''} onChange={(e) => updateDeliverable(selectedClient.id, d.id, { owner: e.target.value })} placeholder="Owner" />
                          </td>
                          <td className="p-2 border">
                            <select className="border rounded-lg px-2 py-1 bg-white" value={d.status} onChange={(e) => updateDeliverable(selectedClient.id, d.id, { status: e.target.value })}>
                              {DELIVERABLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="p-2 border">
                            <input type="text" className="border rounded-lg px-2 py-1 w-full" value={d.notes || ''} onChange={(e) => updateDeliverable(selectedClient.id, d.id, { notes: e.target.value })} placeholder="Notes" />
                          </td>
                          <td className="p-2 border">
                            <button className="btn-soft px-2 py-1 rounded-lg" title="Delete" onClick={() => deleteDeliverable(selectedClient.id, d.id)}>
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
                  <Progress value={selectedClient.deliverablesProgress} />
                </div>
              </TabsContent>

              <TabsContent value="strategies" className="mt-2 text-sm text-gray-700 space-y-3">
                {(selectedClient.strategies?.length ?? 0) === 0 && <p className="text-gray-600">No strategies listed yet.</p>}
                <ul className="list-disc ml-5 space-y-1">
                  {selectedClient.strategies?.map((s, i) => (
                    <li key={i}><span className="text-gray-500 mr-2">[{s.date}]</span>{s.note}</li>
                  ))}
                </ul>
                <Button className="btn-soft" onClick={() => {
                  const note = prompt('Strategy note:'); if (!note) return
                  const item = { note, date: today() }
                  setClients(prev => prev.map(pc => pc.id !== selectedClient.id ? pc : { ...pc, strategies: [item, ...(pc.strategies || [])] }))
                }}>Add Strategy</Button>
              </TabsContent>
            </Tabs>
          </div>
        )
      })()}
    </div>
  )
}