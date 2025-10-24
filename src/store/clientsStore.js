// src/store/clientsStore.js
import { supabase } from '@/lib/supabaseClient';

const STATE_TABLE = 'app_state';
const STATE_KEY = 'clients';

// In-memory cache
let cache = [];                // your UI data: clients array, etc.
let lastRemoteUpdatedAt = null; // server-side updated_at for concurrency control
let listeners = new Set();
let realtimeBound = false;
let initialLoaded = false;

// Helpers
const notify = () => listeners.forEach(fn => fn(cache));

export function subscribe(fn) {
  listeners.add(fn);
  // Don't emit until initial load to avoid UI writing placeholders back to server
  if (initialLoaded) fn(cache);
  return () => listeners.delete(fn);
}

// ---- Load from server (MUST happen before any writes) ----
export async function loadClientsFromServer() {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('data, updated_at')
    .eq('key', STATE_KEY)
    .maybeSingle();

  if (error) {
    console.error('loadClientsFromServer error:', error);
    return;
  }

  if (!data) {
    // No row yet: initialize an empty row ONCE (server is source of truth)
    const initPayload = { data: [], updated_at: new Date().toISOString() };
    const { data: inserted, error: insErr } = await supabase
      .from(STATE_TABLE)
      .insert({ key: STATE_KEY, data: initPayload.data })
      .select('data, updated_at')
      .single();
    if (insErr) {
      console.error('initialize app_state row error:', insErr);
      return;
    }
    cache = inserted.data || [];
    lastRemoteUpdatedAt = inserted.updated_at;
  } else {
    cache = Array.isArray(data.data) ? data.data : [];
    lastRemoteUpdatedAt = data.updated_at;
  }

  initialLoaded = true;
  notify();
}

// ---- Bind realtime (call once early in app) ----
export function bindRealtime() {
  if (realtimeBound) return;
  realtimeBound = true;

  supabase
    .channel('app_state_clients_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STATE_TABLE, filter: `key=eq.${STATE_KEY}` },
      payload => {
        const { new: n } = payload;
        if (!n) return;

        // Only apply if it's newer than our local snapshot
        if (!lastRemoteUpdatedAt || new Date(n.updated_at) > new Date(lastRemoteUpdatedAt)) {
          lastRemoteUpdatedAt = n.updated_at;
          cache = Array.isArray(n.data) ? n.data : [];
          notify();
        }
      }
    )
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
    });
}

// ---- Public getter (optional) ----
export function getClients() {
  return cache;
}

// ---- Merge strategy (shallow): tune as needed ----
function mergeClients(oldClients, newClients) {
  // For a simple dashboard, last-write-wins at the array level:
  // return newClients;
  // If you want smarter merges (by id), implement here:
  const byId = new Map();
  for (const c of oldClients || []) byId.set(c.id, c);
  for (const c of newClients || []) byId.set(c.id, { ...(byId.get(c.id) || {}), ...c });
  return Array.from(byId.values());
}

// ---- Concurrency-safe write ----
async function writeClients(nextClients) {
  if (!initialLoaded) {
    console.warn('writeClients called before initial load — ignored');
    return false;
  }

  // 1) Read fresh row for ETag-like check
  const { data: current, error: readErr } = await supabase
    .from(STATE_TABLE)
    .select('data, updated_at')
    .eq('key', STATE_KEY)
    .single();
  if (readErr) { console.error('write: read current error', readErr); return false; }

  // 2) If server is newer than what we think, MERGE first
  const serverIsNewer =
    lastRemoteUpdatedAt && new Date(current.updated_at) > new Date(lastRemoteUpdatedAt);

  const payload = serverIsNewer
    ? mergeClients(current.data, nextClients)
    : nextClients;

  const candidateUpdatedAt = new Date().toISOString();

  // 3) Concurrency guard: update only if updated_at matches current server value
  const { data: updated, error: updErr } = await supabase
    .from(STATE_TABLE)
    .update({ data: payload, updated_at: candidateUpdatedAt })
    .eq('key', STATE_KEY)
    .eq('updated_at', current.updated_at) // optimistic lock
    .select('data, updated_at')
    .single();

  if (updErr) {
    // Probably lost the race; re-fetch and retry once with merge
    console.warn('write optimistic update failed, refetching…', updErr);

    const { data: refetched, error: refErr } = await supabase
      .from(STATE_TABLE)
      .select('data, updated_at')
      .eq('key', STATE_KEY)
      .single();
    if (refErr) { console.error('refetch after failure error', refErr); return false; }

    const merged = mergeClients(refetched.data, nextClients);
    const { data: updated2, error: updErr2 } = await supabase
      .from(STATE_TABLE)
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq('key', STATE_KEY)
      .eq('updated_at', refetched.updated_at)
      .select('data, updated_at')
      .single();

    if (updErr2) {
      console.error('write failed after merge retry', updErr2);
      return false;
    }

    // Success after retry
    cache = updated2.data || [];
    lastRemoteUpdatedAt = updated2.updated_at;
    notify();
    return true;
  }

  // Success on first try
  cache = updated.data || [];
  lastRemoteUpdatedAt = updated.updated_at;
  notify();
  return true;
}

// ---- Public mutators your UI can call ----
export async function setClients(nextClients) {
  // Update local immediately for snappy UI; remote update follows
  cache = Array.isArray(nextClients) ? nextClients : [];
  notify();
  return writeClients(cache);
}

// Example helpers (optional) – add/remove/edit by id
export async function addClientRow(row) {
  const next = [{ id: crypto.randomUUID(), ...row }, ...cache];
  return setClients(next);
}
export async function updateClientRow(id, partial) {
  const next = cache.map(c => (c.id === id ? { ...c, ...partial } : c));
  return setClients(next);
}
export async function removeClientRow(id) {
  const next = cache.filter(c => c.id !== id);
  return setClients(next);
}
// --- Compatibility exports for legacy imports ---
export { addClientRow as addClient, updateClientRow as updateClient, removeClientRow as removeClient }
