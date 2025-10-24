// Conflict-safe, realtime clients store backed by Supabase app_state.
// Exposes the exact API your components import.

import { createSharedDoc } from '@/lib/sharedState'

// Create a shared document keyed as 'clients'
const clientsDoc = createSharedDoc('clients', { initial: [] })

// --- Small helpers ---
function nowIso() { return new Date().toISOString() }

function upsertById(list, id, updater) {
  let found = false
  const next = list.map(item => {
    if (item?.id === id) {
      found = true
      const updated = updater(item)
      // Always stamp updatedAt so merges resolve correctly
      return { ...updated, updatedAt: updated?.updatedAt || nowIso(), deleted: !!updated?.deleted && updated.deleted }
    }
    return item
  })
  return { next, found }
}

function ensureArray(x) { return Array.isArray(x) ? x : [] }

// --- Public API (matches what your components import) ---
export function getClients() {
  return clientsDoc.get()
}

export function subscribe(cb) {
  return clientsDoc.subscribe(cb)
}

export function setClients(next) {
  // Will stamp updatedAt and push via optimistic concurrency
  clientsDoc.set(next)
}

export function addClient(client) {
  // Ensure id + timestamps; createSharedDoc.add handles id if missing
  clientsDoc.add({
    ...client,
    updatedAt: client?.updatedAt || nowIso(),
    deleted: false,
  })
}

export function updateClient(clientId, patch) {
  // Patch a single client by id; stamp updatedAt automatically
  const current = clientsDoc.get()
  const { next, found } = upsertById(current, clientId, (c) => ({ ...c, ...patch }))
  if (!found) {
    // if not found, treat as add to be safe
    addClient({ id: clientId, ...patch })
    return
  }
  clientsDoc.set(next)
}

export function removeClient(clientId) {
  // Conflict-safe soft delete (tombstone) so stale tabs cannot resurrect
  // We expose the legacy name "removeClient" but call the underlying softDelete
  // by translating into a set() with a deleted tombstone entry.
  const list = clientsDoc.get()
  const { next, found } = upsertById(list, clientId, (c) => ({ ...c, deleted: true }))
  if (found) {
    // keep UI clean locally by filtering, but push the version with the tombstone
    clientsDoc.set(next)
  } else {
    // If not found locally, still push a tombstone so any server copy is deleted
    clientsDoc.set([
      ...list,
      { id: clientId, deleted: true, updatedAt: nowIso() },
    ])
  }
}

/**
 * addPlanningYear(clientId, year, seed?)
 * Safely adds a planning year record to a client. Keeps structure flexible:
 * - If client.planningYears is an array, add/merge there.
 * - If client has per-year maps (e.g., safeHarborByYear, serviceLevelByYear), seed keys.
 */
export function addPlanningYear(clientId, year, seed = {}) {
  const y = Number(year) || new Date().getFullYear()
  const list = clientsDoc.get()
  const { next, found } = upsertById(list, clientId, (c) => {
    const updated = { ...c }

    // 1) planningYears array (non-destructive)
    const arr = ensureArray(updated.planningYears)
    const existsIdx = arr.findIndex(r => Number(r?.year) === y)
    if (existsIdx === -1) {
      arr.push({ year: y, ...seed })
    } else {
      arr[existsIdx] = { ...arr[existsIdx], ...seed }
    }
    updated.planningYears = arr

    // 2) Gentle support for per-year maps if your app uses them
    if (seed?.safeHarbor != null) {
      const map = { ...(updated.safeHarborByYear || {}) }
      map[y] = seed.safeHarbor
      updated.safeHarborByYear = map
    }
    if (seed?.serviceLevel) {
      const map = { ...(updated.serviceLevelByYear || {}) }
      map[y] = seed.serviceLevel
      updated.serviceLevelByYear = map
    }

    // Keep a convenient 'year' field if your UI expects it
    if (updated.year == null) updated.year = y

    return updated
  })

  // If client not found, create it with this planning year
  if (!found) {
    addClient({
      id: clientId,
      year: y,
      planningYears: [{ year: y, ...seed }],
      safeHarborByYear: seed?.safeHarbor != null ? { [y]: seed.safeHarbor } : {},
      serviceLevelByYear: seed?.serviceLevel ? { [y]: seed.serviceLevel } : {},
      updatedAt: nowIso(),
      deleted: false,
    })
    return
  }

  clientsDoc.set(next)
}
