// src/store/ownersStore.js
import { supabase } from '@/lib/supabaseClient';

const STATE_TABLE = 'app_state';
const STATE_KEY = 'owners';

let cache = [];                 // [{ id, name, email, ... }]
let lastRemoteUpdatedAt = null;
let listeners = new Set();
let realtimeBound = false;
let initialLoaded = false;

const notify = () => listeners.forEach((fn) => fn(cache));

export function subscribeOwners(fn) {
  listeners.add(fn);
  if (initialLoaded) fn(cache);
  return () => listeners.delete(fn);
}

export function getOwners() {
  return cache;
}

export async function loadOwnersFromServer() {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('data, updated_at')
    .eq('key', STATE_KEY)
    .maybeSingle();

  if (error) {
    console.error('loadOwnersFromServer error:', error);
    return;
  }

  if (!data) {
    const init = { data: [], updated_at: new Date().toISOString() };
    const { data: inserted, error: insErr } = await supabase
      .from(STATE_TABLE)
      .insert({ key: STATE_KEY, data: init.data })
      .select('data, updated_at')
      .single();
    if (insErr) {
      console.error('initialize owners row error:', insErr);
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

export function bindOwnersRealtime() {
  if (realtimeBound) return;
  realtimeBound = true;

  supabase
    .channel('app_state_owners_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STATE_TABLE, filter: `key=eq.${STATE_KEY}` },
      (payload) => {
        const n = payload?.new;
        if (!n) return;
        if (!lastRemoteUpdatedAt || new Date(n.updated_at) > new Date(lastRemoteUpdatedAt)) {
          lastRemoteUpdatedAt = n.updated_at;
          cache = Array.isArray(n.data) ? n.data : [];
          notify();
        }
      }
    )
    .subscribe();
}

// ---- merge (by id) so concurrent edits don’t wipe each other
function mergeOwners(oldArr, newArr) {
  const byId = new Map();
  for (const o of oldArr || []) byId.set(o.id, o);
  for (const o of newArr || []) byId.set(o.id, { ...(byId.get(o.id) || {}), ...o });
  return Array.from(byId.values());
}

async function writeOwners(next) {
  if (!initialLoaded) {
    console.warn('writeOwners before initial load — ignored');
    return false;
  }

  const { data: current, error: readErr } = await supabase
    .from(STATE_TABLE)
    .select('data, updated_at')
    .eq('key', STATE_KEY)
    .single();
  if (readErr) { console.error('owners write read error', readErr); return false; }

  const serverIsNewer =
    lastRemoteUpdatedAt && new Date(current.updated_at) > new Date(lastRemoteUpdatedAt);
  const payload = serverIsNewer ? mergeOwners(current.data, next) : next;

  const { data: updated, error: updErr } = await supabase
    .from(STATE_TABLE)
    .update({ data: payload, updated_at: new Date().toISOString() })
    .eq('key', STATE_KEY)
    .eq('updated_at', current.updated_at) // optimistic lock
    .select('data, updated_at')
    .single();

  if (updErr) {
    // retry once with merge
    const { data: refetched, error: refErr } = await supabase
      .from(STATE_TABLE)
      .select('data, updated_at')
      .eq('key', STATE_KEY)
      .single();
    if (refErr) { console.error('owners refetch error', refErr); return false; }

    const merged = mergeOwners(refetched.data, next);
    const { data: updated2, error: updErr2 } = await supabase
      .from(STATE_TABLE)
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq('key', STATE_KEY)
      .eq('updated_at', refetched.updated_at)
      .select('data, updated_at')
      .single();

    if (updErr2) { console.error('owners write retry failed', updErr2); return false; }

    cache = updated2.data || [];
    lastRemoteUpdatedAt = updated2.updated_at;
    notify();
    return true;
  }

  cache = updated.data || [];
  lastRemoteUpdatedAt = updated.updated_at;
  notify();
  return true;
}

export async function setOwners(next) {
  cache = Array.isArray(next) ? next : [];
  notify();
  return writeOwners(cache);
}

export async function addOwnerRow(row) {
  const next = [{ id: crypto.randomUUID(), ...row }, ...cache];
  return setOwners(next);
}
export async function updateOwnerRow(id, partial) {
  const next = cache.map(o => (o.id === id ? { ...o, ...partial } : o));
  return setOwners(next);
}
export async function removeOwnerRow(id) {
  const next = cache.filter(o => o.id !== id);
  return setOwners(next);
}
