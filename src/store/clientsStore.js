// Minimal shared store for the JAG dashboard.
// Keeps the existing synchronous API (getClients/setClients/addClient/subscribe)
// but persists to Supabase app_state under key "clients" and listens to realtime
// updates so all users stay in sync.

import { supabase } from '@/lib/supabaseClient'

const LOCAL_KEY = 'jag_clients_dashboard'
const STATE_KEY = 'clients' // row key in app_state

let cache = []
let subscribers = new Set()
let initialized = false

// ---------- helpers ----------
function notify() {
  for (const cb of Array.from(subscribers)) {
    try { cb(cache) } catch {}
  }
}
function setLocal(next) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch {}
}
function getLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function shallowEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

// ---------- Supabase I/O ----------
async function pullFromSupabase() {
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('key', STATE_KEY)
    .single()

  // Not found is ok (code PGRST116) — means first run.
  if (error && error.code !== 'PGRST116') {
    console.warn('[clientsStore] fetch error', error)
    return
  }
  if (data?.data) {
    const next = Array.isArray(data.data) ? data.data : []
    if (!shallowEqual(next, cache)) {
      cache = next
      setLocal(cache)
      notify()
    }
  }
}

async function pushToSupabase(next) {
  const { error } = await supabase
    .from('app_state')
    .upsert({ key: STATE_KEY, data: next })
  if (error) console.warn('[clientsStore] upsert error', error)
}

// ---------- realtime ----------
let unsubscribeRealtime = null
function startRealtime() {
  if (unsubscribeRealtime) return
  const channel = supabase
    .channel('app_state:clients')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_state' },
      (payload) => {
        if (payload.new?.key === STATE_KEY) {
          const next = Array.isArray(payload.new.data) ? payload.new.data : []
          if (!shallowEqual(next, cache)) {
            cache = next
            setLocal(cache)
            notify()
          }
        }
      },
    )
    .subscribe()

  unsubscribeRealtime = () => supabase.removeChannel(channel)
}

// ---------- public API ----------
export function getClients() {
  // synchronous for initial render
  if (!initialized) {
    // seed from local first for instant paint
    cache = getLocal()
    // then async hydrate from server
    initialized = true
    pullFromSupabase().catch(() => {})
    startRealtime()
  }
  return cache
}

export function setClients(next) {
  cache = Array.isArray(next) ? next : []
  setLocal(cache)
  notify()
  // fire-and-forget persistence
  pushToSupabase(cache)
}

export function addClient(client) {
  if (!client || !client.id) return
  cache = [client, ...cache]
  setLocal(cache)
  notify()
  pushToSupabase(cache)
}

export function subscribe(cb) {
  if (typeof cb !== 'function') return () => {}
  subscribers.add(cb)
  // call immediately with current cache
  try { cb(cache) } catch {}
  return () => { subscribers.delete(cb) }
}
// --- helpers you likely already have ---
const LS_KEY = 'clientsStore';
const load = () => JSON.parse(localStorage.getItem(LS_KEY) || '{"clients":[]}');
const save = (state) => localStorage.setItem(LS_KEY, JSON.stringify(state));

// --- ensure you have a shared state object ---
let state = load();

/**
 * Update a client by id with partial fields (name, entityType, notes, etc.)
 * Usage: updateClient(clientId, { name: "New Name", notes: "..." })
 */
export function updateClient(clientId, updates) {
  state.clients = (state.clients || []).map(c =>
    c.id === clientId ? { ...c, ...updates } : c
  );
  save(state);
  return state.clients.find(c => c.id === clientId);
}
