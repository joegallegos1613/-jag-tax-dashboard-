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

// 🔗 Shared client store (used by /clients page too)
import {
  getClients as storeGetClients,
  setClients as storeSetClients,
  addClient as storeAddClient,
  subscribe as storeSubscribe,
} from './store/clientsStore'

// ----------------------------------------------
// Constants
// ----------------------------------------------
const SERVICE_LEVELS = ['Clarity', 'On Demand', 'Elevate']
const PAYMENT_STATUSES = ['Pending', 'Sent', 'Paid']
const DELIVERABLE_TYPES = ['Estimate', 'Info Request', 'Meeting', 'Payment Request', 'Projection', 'Return Sent', 'Strategy Memo']
const DELIVERABLE_STATUSES = ['Planned', 'Requested', 'Sent', 'Completed']

// Seed data (unchanged)
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
    safeHarbor: 65000, // legacy single-year; we fall back to this when year map missing
    deliverablesProgress: 75,
    estimateOwner: 'Averey',
    meetingOwner: 'Joe',
    requestOwner: 'Hector',
    strategies: [],
    deliverables: [
      { id: 'd1', type: 'Estimate', date: '2024-03-10', owner: 'Averey', status: 'Sent', notes: 'Q1 SH estimate emailed' },
      { id: 'd2', type: 'Meeting',  date: '2024-06-15', owner: 'Joe',    status: 'Completed', notes: 'Mid-year planning' },
      { id: 'd3', type: 'Info Request', date: '2024-09-10', owner: 'Hector', status: 'Requested', notes: 'Q3 docs' }
    ],
    paymentRequests: [
      { quarter: 'Q1', requestDate: '2024-03-10', amount: 12000, status: 'Paid', owner: 'Averey' },
      { quarter: 'Q2', requestDate: '2024-06-10', amount: 14000, status: 'Paid', owner: 'Joe' },
      { quarter: 'Q3', requestDate: '2024-09-10', amount: 16000, status: 'Pending', owner: 'Hector' },
      { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null }
    ]
  },
  {
    id: '800101-2',
    group: 'Riverstone Ventures LLC',
    client: 'Sarah Nguyen',
    entity: 'S Corp',
    serviceLevel: 'Clarity',
    risk: 'Medium',
    status: 'Active',
    year: 2025,
    safeHarbor: 32000,
    deliverablesProgress: 40,
    estimateOwner: 'Averey',
    meetingOwner: 'Joe',
    requestOwner: 'Hector',
    strategies: [],
    deliverables: [
      { id: 'rv1', type: 'Info Request', date: '2025-02-01', owner: 'Hector', status: 'Requested', notes: 'Bank stmts 2025 YTD' },
      { id: 'rv2', type: 'Estimate',     date: '2025-04-10', owner: 'Averey', status: 'Sent', notes: 'Q1 estimate' }
    ],
    paymentRequests: [
      { quarter: 'Q1', requestDate: '2025-04-12', amount: 6000, status: 'Paid', owner: 'Averey' },
      { quarter: 'Q2', requestDate: '2025-06-15', amount: 7000, status: 'Pending', owner: 'Joe' },
      { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null }
    ]
  },
  {
    id: '900222-3',
    group: 'Triet Harari LLC',
    client: 'Daniel Lee',
    entity: 'Partnership',
    serviceLevel: 'On Demand',
    risk: 'Low',
    status: 'Active',
    year: 2025,
    safeHarbor: 15000,
    deliverablesProgress: 20,
    estimateOwner: 'Averey',
    meetingOwner: 'Joe',
    requestOwner: 'Hector',
    strategies: [],
    deliverables: [
      { id: 'th1', type: 'Info Request', date: '2025-03-05', owner: 'Hector', status: 'Requested', notes: '1099s & payroll' }
    ],
    paymentRequests: [
      { quarter: 'Q1', requestDate: '2025-04-15', amount: 3000, status: 'Paid', owner: 'Hector' },
      { quarter: 'Q2', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null }
    ]
  },
  {
    id: '1000333-4',
    group: 'RealSteel Center LLC',
    client: 'Javier Mendez',
    entity: 'S Corp',
    serviceLevel: 'Elevate',
    risk: 'High',
    status: 'Active',
    year: 2025,
    safeHarbor: 90000,
    deliverablesProgress: 55,
    estimateOwner: 'Averey',
    meetingOwner: 'Joe',
    requestOwner: 'Hector',
    strategies: [],
    deliverables: [
      { id: 'rs1', type: 'Meeting', date: '2025-01-20', owner: 'Joe', status: 'Completed', notes: 'Kickoff planning' },
      { id: 'rs2', type: 'Estimate', date: '2025-03-31', owner: 'Averey', status: 'Sent', notes: 'Q1 SH sent' }
    ],
    paymentRequests: [
      { quarter: 'Q1', requestDate: '2025-04-05', amount: 22000, status: 'Paid', owner: 'Averey' },
      { quarter: 'Q2', requestDate: '2025-06-10', amount: 23000, status: 'Paid', owner: 'Joe' },
      { quarter: 'Q3', requestDate: '2025-09-10', amount: 24000, status: 'Pending', owner: 'Hector' },
      { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null },
      { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null }
    ]
  }
]

// ----------------------------------------------
// Helpers
// ----------------------------------------------
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

// Year-scoped KPIs from deliverables
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
  const need = requiredMeetings(c.serviceLevel)
  if (meetingsHeld < need) alerts.push({ id: 'meeting-min', level: 'warn', text: `Meetings below minimum (${meetingsHeld}/${need}) for ${c.serviceLevel}` })
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

// --------- Safe Harbor per-year helpers ---------
function getSafeHarbor(clientLike, taxYear) {
  // prefer map; else fall back to legacy single value
  const map = clientLike.safeHarborByYear || {}
  const val = map[taxYear]
  if (typeof val === 'number') return val
  return typeof clientLike.safeHarbor === 'number' ? clientLike.safeHarbor : 0
}
function setSafeHarborForYear(stateSetter, clientId, taxYear, newValue) {
  const val = Number(newValue)
  if (!Number.isFinite(val) || val < 0) return
  stateSetter(prev => prev.map(c => {
    if (c.id !== clientId) return c
    const nextMap = { ...(c.safeHarborByYear || {}) , [taxYear]: val }
    // keep legacy safeHarbor in sync when the edited year equals c.year
    const legacy = Number(c.year) === Number(taxYear) ? val : (c.safeHarbor ?? 0)
    return { ...c, safeHarborByYear: nextMap, safeHarbor: legacy }
  }))
}

// Store <-> Dashboard adapters
function toStoreFromDashboard(d) {
  return {
    id: d.id,
    name: d.group,
    entityType: d.entity || 'Individual',
    notes: '',
    years: [Number(d.year || new Date().getFullYear())],
  }
}

// Expand rows: one row per (client × year)
function expandRows(dashboardClients, storeClients) {
  const yearsById = new Map()
  const nameToYears = new Map()
  for (const s of storeClients) {
    yearsById.set(s.id, s.years || [])
    nameToYears.set((s.name || '').toLowerCase(), s.years || [])
  }
  const rows = []
  for (const c of dashboardClients) {
    const fromId = yearsById.get(c.id)
    const fromName = nameToYears.get((c.group || '').toLowerCase())
    let years = fromId || fromName || (c.year ? [Number(c.year)] : [])
    if (!years || years.length === 0) years = [new Date().getFullYear()]
    for (const y of years) rows.push({ ...c, rowYear: Number(y), rowId: `${c.id}__${y}` })
  }
  rows.sort((a, b) => (b.rowYear || 0) - (a.rowYear || 0))
  return rows
}

// ----------------------------------------------
// Component
// ----------------------------------------------
export default function TaxPlanningDashboard() {
  // load dashboard cache
  const [clients, setClients] = useState(() => {
    try {
      const saved = localStorage.getItem('jag_clients_dashboard')
      return saved ? JSON.parse(saved) : DEFAULT_CLIENTS
    } catch { return DEFAULT_CLIENTS }
  })

  // hydrate store if empty once
  useEffect(() => {
    const storeClients = storeGetClients()
    if (!storeClients || storeClients.length === 0) {
      const seed = clients.map(toStoreFromDashboard)
      storeSetClients(seed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // subscribe to store
  useEffect(() => {
    const syncFromStore = () => {
      const latestStore = storeGetClients()
      setClients(prev => {
        const dashById = new Map(prev.map(c => [c.id, c]))
        const dash = [...prev]
        for (const s of latestStore) {
          if (!dashById.has(s.id)) {
            dash.unshift({
              id: s.id,
              group: s.name,
              client: '',
              entity: s.entityType || 'Individual',
              serviceLevel: 'Clarity',
              risk: 'Low',
              status: 'Active',
              year: (s.years && s.years[0]) || new Date().getFullYear(),
              safeHarbor: 0,
              deliverablesProgress: 0,
              strategies: [],
              deliverables: [],
              estimateOwner: '',
              meetingOwner: '',
              requestOwner: '',
              paymentRequests: [
                { quarter: 'Q1', requestDate: null, amount: null, status: 'Pending', owner: null },
                { quarter: 'Q2', requestDate: null, amount: null, status: 'Pending', owner: null },
                { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', owner: null },
                { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null },
                { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null },
              ]
            })
          } else {
            dashById.get(s.id).entity = s.entityType || dashById.get(s.id).entity
          }
        }
        localStorage.setItem('jag_clients_dashboard', JSON.stringify(dash))
        return dash
      })
    }
    const unsub = storeSubscribe(() => syncFromStore())
    syncFromStore()
    return unsub
  }, [])

  useEffect(() => {
    localStorage.setItem('jag_clients_dashboard', JSON.stringify(clients))
  }, [clients])

  // UI state
  const [yearFilter, setYearFilter] = useState('All')
  const [risk, setRisk] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)

  const storeClients = storeGetClients()
  const expandedRows = useMemo(() => expandRows(clients, storeClients), [clients, storeClients])

  const filtered = useMemo(() => {
    return expandedRows.filter(r =>
      (yearFilter === 'All' || Number(r.rowYear) === Number(yearFilter)) &&
      (risk === 'All' || r.risk === risk) &&
      (query.length < 2 || [r.group, r.client, r.entity].join(' ').toLowerCase().includes(query.toLowerCase()))
    )
  }, [expandedRows, yearFilter, risk, query])

  useEffect(() => {
    if (!selectedClient) return
    const hasRow = expandedRows.find(r => r.id === selectedClient.id && r.rowYear === selectedYear)
    if (!hasRow) {
      const fallback = selectedClient.year || (storeClients.find(s => s.id === selectedClient.id)?.years?.[0])
      setSelectedYear(Number(fallback || new Date().getFullYear()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, expandedRows])

  // ------- CRUD helpers (write to both: dashboard + store) -------
  function addClient() {
    const group = prompt('Client/Group name (e.g., CB Direct, LLC):'); if (!group) return
    const client = prompt('Primary contact (e.g., Michael Cain):') || ''
    const entity = prompt('Entity type (Individual / S Corp / Partnership / C Corp):') || 'Individual'
    const taxYearInput = prompt('Tax Year (e.g., 2024):', String(new Date().getFullYear())) || String(new Date().getFullYear())
    const taxYear = Number(taxYearInput) || new Date().getFullYear()
    const serviceLevel = prompt('Service Level (Clarity / On Demand / Elevate):') || 'Clarity'
    const id = `${Date.now()}`

    const newClient = {
      id, group, client, entity, serviceLevel, risk: 'Low', status: 'Active',
      year: taxYear,
      safeHarbor: 0,
      safeHarborByYear: { [taxYear]: 0 }, // seed per-year map
      deliverablesProgress: 0, strategies: [], deliverables: [],
      estimateOwner: '', meetingOwner: '', requestOwner: '',
      paymentRequests: [
        { quarter: 'Q1', requestDate: null, amount: null, status: 'Pending', owner: null, taxYear },
        { quarter: 'Q2', requestDate: null, amount: null, status: 'Pending', owner: null, taxYear },
        { quarter: 'Q3', requestDate: null, amount: null, status: 'Pending', owner: null, taxYear },
        { quarter: 'Q4', requestDate: null, amount: null, status: 'Pending', owner: null, taxYear },
        { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null, taxYear },
      ]
    }

    setClients(prev => {
      const next = [newClient, ...prev]
      localStorage.setItem('jag_clients_dashboard', JSON.stringify(next))
      return next
    })

    storeAddClient({ id, name: group, entityType: entity, notes: '', taxYear })
    setSelectedClient(newClient)
    setSelectedYear(taxYear)
  }

  function deleteClient(clientId) {
    if (!confirm('Delete this client? This action cannot be undone.')) return
    const filteredClients = clients.filter(c => c.id !== clientId)
    setClients(filteredClients)
    setSelectedClient(null)
    const keep = storeClients.filter(s => s.id !== clientId)
    storeSetClients(keep)
  }

  function addOrUpdatePayment(c) {
    let quarter = prompt('Quarter to add/update (Q1, Q2, Q3, Q4, Extension or EXT):')
    if (!quarter) return
    quarter = quarter.trim().toUpperCase()
    if (quarter === 'EXT') quarter = 'EXTENSION'
    const allowed = ['Q1','Q2','Q3','Q4','EXTENSION']
    if (!allowed.includes(quarter)) return alert('Please enter Q1/Q2/Q3/Q4/Extension (or EXT)')
    const normalizedQuarter = quarter === 'EXTENSION' ? 'Extension' : quarter

    const requestDate = prompt('Request date (YYYY-MM-DD):', today())
    const amount = Number(prompt('Amount (just numbers):', '0') || 0)
    const status = prompt('Status (Pending / Sent / Paid):', 'Pending') || 'Pending'
    const owner = prompt('Owner (name):', c?.requestOwner || '') || null

    const taxYear = Number(selectedYear || c.year || new Date().getFullYear())

    setClients(prev => prev.map(pc => {
      if (pc.id !== c.id) return pc
      const ensureExt = arr =>
        arr.some(p => p.quarter === 'Extension')
          ? arr
          : [...arr, { quarter: 'Extension', requestDate: null, amount: null, status: 'Pending', owner: null, taxYear }]
      const base = ensureExt(pc.paymentRequests || [])
      const paymentRequests = base.map(p =>
        p.quarter === normalizedQuarter
          ? { quarter: normalizedQuarter, requestDate, amount, status, owner, taxYear }
          : p
      )
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

  function updateSafeHarborForSelectedYear(clientId, newValue) {
    setSafeHarborForYear(setClients, clientId, selectedYear, newValue)
  }

  // Deliverables — year-stamped & filtered
  function addDeliverable(c, preset) {
    const taxYear = Number(selectedYear || c.year || new Date().getFullYear())
    const type = preset?.type || prompt(`Type (${DELIVERABLE_TYPES.join(' / ')}):`, 'Estimate') || 'Estimate'
    const date = preset?.date || prompt('Date (YYYY-MM-DD):', today()) || today()
    const owner = preset?.owner || prompt('Owner:', 'Unassigned') || 'Unassigned'
    const status = preset?.status || prompt(`Status (${DELIVERABLE_STATUSES.join(' / ')}):`, 'Planned') || 'Planned'
    const notes = preset?.notes ?? (prompt('Notes (optional):', '') || '')
    const item = { id: `${Date.now()}`, type, date, owner, status, notes, taxYear }
    setClients(prev => prev.map(pc => pc.id !== c.id ? pc : { ...pc, deliverables: [item, ...(pc.deliverables || [])] }))
  }

  function deleteDeliverable(clientId, deliverableId) {
    setClients(prev => prev.map(pc => pc.id !== clientId ? pc : { ...pc, deliverables: (pc.deliverables || []).filter(d => d.id !== deliverableId) }))
  }

  function updateDeliverable(clientId, deliverableId, patch) {
    setClients(prev => prev.map(pc => {
      if (pc.id !== clientId) return pc
      const deliverables = (pc.deliverables || []).map(d => {
        if (d.id !== deliverableId) return d
        const newTaxYear = patch.date ? (yearOf(patch.date) ?? selectedYear ?? pc.year) : d.taxYear
        return { ...d, ...patch, taxYear: newTaxYear }
      })
      return { ...pc, deliverables }
    }))
  }

  // ----------------------------------------------
  // UI
  // ----------------------------------------------
  return (
    <div className="p-0 font-sans max-w-7xl mx-auto">
      {/* Header */}
      <div className="app-hero px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">JAG — Client-Level Tax Planning</h1>
        </div>

        <div className="mt-4 flex gap-3 items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input placeholder="Search client or entity..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {/* Tax Year filter */}
          <select className="border rounded-xl px-3 py-2 bg-white" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} disabled={!!selectedClient}>
            <option value="All">All Tax Years</option>
            {[...new Set(expandedRows.map(r => r.rowYear))].sort((a,b)=>a-b).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select className="border rounded-xl px-3 py-2 bg-white" value={risk} onChange={(e) => setRisk(e.target.value)} disabled={!!selectedClient}>
            {['All','Low','Medium','High'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {!selectedClient && <Button onClick={addClient}>+ Add Client</Button>}
          {selectedClient && (
            <>
              <Button className="btn-soft" onClick={() => { setSelectedClient(null); setSelectedYear(null) }}>← Back to Dashboard</Button>
              <Button className="btn-soft" onClick={() => deleteClient(selectedClient.id)} title="Delete client">🗑 Delete Client</Button>
            </>
          )}
        </div>
      </div>

      {/* Table: one row per (client × year) with YTD Paid and year-scoped Safe Harbor */}
      {!selectedClient && (
        <div className="px-6 -mt-6">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-12 text-xs text-gray-500 font-medium border-b pb-2">
                <div className="col-span-3">Client</div>
                <div className="col-span-1">Tax Year</div>
                <div className="col-span-1">Entity</div>
                <div className="col-span-1">Service Level</div>
                <div className="col-span-1">Risk</div>
                <div className="col-span-1">Safe Harbor</div>
                <div className="col-span-1">Estimates Sent</div>
                <div className="col-span-1">Meetings Held</div>
                <div className="col-span-1">Requests Sent</div>
                <div className="col-span-1">YTD Paid</div>
              </div>

              {filtered.map((r) => {
                const { estimatesSent, meetingsHeld, requestsSent } = kpisFromDeliverablesForYear(r, r.rowYear)
                const alerts = getAlertsForYear(r, r.rowYear)
                const rowTone = alerts.some(a => a.level === 'error') ? 'bg-red-50' : alerts.some(a => a.level === 'warn') ? 'bg-amber-50' : 'bg-white'
                const ytdPaid = totalPaidForYear(r, r.rowYear)
                const safeHarborVal = getSafeHarbor(r, r.rowYear)
                return (
                  <div
                    key={r.rowId}
                    onClick={() => { setSelectedClient(r); setSelectedYear(r.rowYear); }}
                    className={`grid grid-cols-12 items-center border-b py-2 text-sm hover:bg-gray-50 cursor-pointer rounded-lg ${rowTone}`}
                  >
                    <div className="col-span-3 font-medium">{r.group}</div>
                    <div className="col-span-1 text-gray-700">{r.rowYear}</div>
                    <div className="col-span-1 text-gray-600">{r.entity}</div>
                    <div className="col-span-1 text-gray-600">{r.serviceLevel}</div>
                    <div className="col-span-1"><Badge className={r.risk === 'High' ? 'pill-err' : r.risk === 'Medium' ? 'pill-warn' : 'pill-okay'}>{r.risk}</Badge></div>
                    <div className="col-span-1">${(safeHarborVal ?? 0).toLocaleString()}</div>
                    <div className="col-span-1 text-center">{estimatesSent}</div>
                    <div className="col-span-1 text-center">{meetingsHeld}</div>
                    <div className="col-span-1 text-center">{requestsSent}</div>
                    <div className="col-span-1 text-center font-semibold">${ytdPaid.toLocaleString()}</div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail drawer (year-scoped KPIs, Payments, Deliverables, Safe Harbor editor) */}
      {selectedClient && (() => {
        const alerts = getAlertsForYear(selectedClient, selectedYear)
        const tone = alerts.some(a => a.level === 'error') ? 'err' : alerts.some(a => a.level === 'warn') ? 'warn' : 'ok'
        const title = tone === 'err' ? 'Issues detected' : tone === 'warn' ? 'Action recommended' : 'All good'

        const { estimatesSent, meetingsHeld, requestsSent } = kpisFromDeliverablesForYear(selectedClient, selectedYear)

        const paymentsForYear = (selectedClient.paymentRequests || []).filter(p => {
          const y = p.taxYear ?? yearOf(p.requestDate) ?? selectedClient.year ?? null
          return Number(y) === Number(selectedYear)
        })

        const deliverablesForYear = (selectedClient.deliverables || []).filter(d => {
          const y = d.taxYear ?? yearOf(d.date) ?? selectedClient.year ?? null
          return Number(y) === Number(selectedYear)
        })

        const safeHarborForYear = getSafeHarbor(selectedClient, selectedYear)

        return (
          <div className="px-6 mt-6 space-y-4">
            <div className="text-sm text-gray-500">
              Editing for <span className="font-semibold">{selectedClient.group}</span> · <span className="font-semibold">Tax Year {selectedYear}</span>
            </div>

            <Alert tone={tone} title={title}>
              {alerts.length === 0 ? 'Client is meeting baseline targets.' : (
                <ul className="list-disc ml-5">
                  {alerts.map(a => <li key={a.id}>{a.text}</li>)}
                </ul>
              )}
            </Alert>

            {/* KPI quick actions + Safe Harbor (year-scoped) */}
            <Card>
              <CardContent className="flex flex-wrap gap-3 items-center">
                <div className="text-sm text-gray-600">
                  Safe Harbor Target ($):
                  <input
                    type="number"
                    className="border rounded-xl px-3 py-2 w-40 ml-2"
                    value={safeHarborForYear ?? 0}
                    min={0}
                    onChange={(e) => updateSafeHarborForSelectedYear(selectedClient.id, e.target.value)}
                  />
                </div>

                <div className="text-sm text-gray-600">Estimates Sent: <span className="font-semibold">{estimatesSent}</span></div>
                <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Estimate', status: 'Sent', owner: selectedClient.estimateOwner || 'Unassigned', date: today(), notes: 'Estimate sent' })}>+ Estimate</Button>

                <div className="text-sm text-gray-600">Meetings Held: <span className="font-semibold">{meetingsHeld}</span></div>
                <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Meeting', status: 'Completed', owner: selectedClient.meetingOwner || 'Unassigned', date: today(), notes: 'Planning meeting' })}>+ Meeting</Button>

                <div className="text-sm text-gray-600">Requests Sent: <span className="font-semibold">{requestsSent}</span></div>
                <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Info Request', status: 'Requested', owner: selectedClient.requestOwner || 'Unassigned', date: today(), notes: 'Docs requested' })}>+ Info Request</Button>

                <div className="ml-auto text-sm text-gray-600">
                  YTD Paid: <span className="font-semibold">${totalPaidForYear(selectedClient, selectedYear).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="payments">
              <TabsList className="mt-2">
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="strategies">Strategies</TabsTrigger>
              </TabsList>

              {/* PAYMENTS (year-scoped) */}
              <TabsContent value="payments" className="mt-2 text-sm text-gray-700 space-y-3">
                <div className="flex gap-2">
                  <Button className="btn-soft" onClick={() => addOrUpdatePayment(selectedClient)}>+ Add/Update Payment</Button>
                </div>
                <div className="grid md:grid-cols-5 gap-3">
                  {paymentsForYear.map((p, i) => (
                    <Card key={i} className="rounded-xl p-3 text-sm">
                      <div className="font-semibold">{p.quarter}</div>
                      <div className="text-gray-600">Requested: {p.requestDate || '—'}</div>
                      <div className="text-gray-600">Amount: {p.amount ? `$${p.amount.toLocaleString()}` : '—'}</div>
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <select
                          className="border rounded-lg px-2 py-1 bg-white"
                          value={p.status || 'Pending'}
                          onChange={(e) => updatePaymentStatus(selectedClient.id, p.quarter, e.target.value)}
                        >
                          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="text-gray-600">Owner: {p.owner || 'Unassigned'}</div>
                      <div className="text-gray-400 text-xs">Tax Year: {p.taxYear ?? (yearOf(p.requestDate) ?? selectedClient.year)}</div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* DELIVERABLES (year-scoped) */}
              <TabsContent value="deliverables" className="mt-2 text-sm text-gray-700 space-y-2">
                <div className="flex gap-2">
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient)}>+ Add Deliverable</Button>
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Estimate', status: 'Sent', owner: selectedClient.estimateOwner || 'Unassigned', date: today(), notes: 'Estimate sent' })}>+ Quick Estimate</Button>
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Meeting', status: 'Completed', owner: selectedClient.meetingOwner || 'Unassigned', date: today(), notes: 'Meeting held' })}>+ Quick Meeting</Button>
                  <Button className="btn-soft" onClick={() => addDeliverable(selectedClient, { type: 'Info Request', status: 'Requested', owner: selectedClient.requestOwner || 'Unassigned', date: today(), notes: 'Docs requested' })}>+ Quick Request</Button>
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
                            <select className="border rounded-lg px-2 py-1 bg-white" value={d.type} onChange={(e) => updateDeliverable(selectedClient.id, d.id, { type: e.target.value })}>
                              {DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="p-2 border">
                            <input
                              type="date"
                              className="border rounded-lg px-2 py-1"
                              value={d.date || ''}
                              onChange={(e) => updateDeliverable(selectedClient.id, d.id, { date: e.target.value })}
                            />
                            <div className="text-[10px] text-gray-400 mt-0.5">Tax Year: {d.taxYear ?? (yearOf(d.date) ?? selectedClient.year)}</div>
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

              {/* STRATEGIES (not year-scoped yet; can scope if you want later) */}
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
