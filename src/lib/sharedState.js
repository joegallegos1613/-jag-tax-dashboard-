// Generic shared document with optimistic concurrency + realtime + tombstones.
// Stores JSON in app_state(key), with fields: { data, version }.
// Rules:
//  - Each item inside arrays should carry { id, updatedAt, deleted? }.
//  - When merging conflicts, newer updatedAt wins; any {deleted:true} wins over non-deleted.

import { supabase } from '@/lib/supabaseClient'

function nowIso() { return new Date().toISOString() }
function asArray(x) { return Array.isArray(x) ? x : [] }
function toMapById(arr) {
  const m = new Map()
  asArray(arr).forEach(it => { if (it && it.id != null) m.set(String(it.id), it) })
  return m
}

function mergeItems(serverArr, localArr) {
  const s = toMapById(serverArr)
  const l = toMapById(localArr)
  const ids = new Set([...s.keys(), ...l.keys()])
  const out = []
  ids.forEach(id => {
    const a = s.get(id)
    const b = l.get(id)
    if (!a && b) { out.push(b); return }
    if (a && !b) { out.push(a); return }
    // both exist -> resolve by updatedAt; deletion always wins on tie or if newer
    const au = a?.updatedAt || '1970-01-01T00:00:00.000Z'
    const bu = b?.updatedAt || '1970-01-01T00:00:00.000Z'
    if ((b?.deleted && !a?.deleted) || (a?.deleted && b?.deleted)) {
      // both deleted or local deleted -> pick newer deleted
      out.push( new Date(bu) >= new Date(au) ? b : a )
      return
    }
    if (a?.deleted && !b?.deleted) {
      // server says deleted; compare timestamps—if local is strictly newer, keep local, else keep delete
      if (new Date(bu) > new Date(au)) out.push(b); else out.push(a)
      return
    }
    // neither deleted -> pick newer
    out.push( new Date(bu) >= new Date(au) ? b : a )
  })
  // Finally, drop hard-deleted items from the array for UI; they still exist logically as deletions
  return out.filter(x => !x?.deleted)
}

export function createSharedDoc(key, { initial = [], onHydrated } = {}) {
  let cache = asArray(initial)
  let serverVersion = 0
  let initialized = false
  const subs = new Set()

  function notify() { subs.forEach(cb => { try { cb(cache) } catch {} }) }

  async function hydrate() {
    const { data, error } = await supabase.from('app_state')
      .select('data, version')
      .eq('key', key)
      .single()
    // Not found: first boot -> seed a row
    if (error && error.code === 'PGRST116') {
      await supabase.from('app_state').insert({ key, data: cache, version: 0 })
      serverVersion = 0
      initialized = true
      onHydrated?.(cache)
      return
    }
    if (error) { console.warn(`[${key}] hydrate error`, error); return }
    cache = asArray(data?.data)
    serverVersion = data?.version ?? 0
    initialized = true
    onHydrated?.(cache)
    notify()
  }

  async function push(nextArr, { retry = true } = {}) {
    // Try conditional update: only succeed if version matches
    const nextVersion = serverVersion + 1
    const { error, count } = await supabase
      .from('app_state')
      .update({ data: nextArr, version: nextVersion })
      .eq('key', key)
      .eq('version', serverVersion)
      .select('*', { count: 'exact', head: true })

    if (!error && count === 1) {
      serverVersion = nextVersion
      return true
    }

    // Version conflict -> merge and retry once
    if (retry) {
      const { data: cur, error: e2 } = await supabase
        .from('app_state')
        .select('data, version')
        .eq('key', key)
        .single()
      if (e2) { console.warn(`[${key}] refetch after conflict failed`, e2); return false }
      const merged = mergeItems(cur?.data, nextArr)
      serverVersion = cur?.version ?? serverVersion
      cache = merged
      notify()
      return push(merged, { retry: false })
    }
    if (error) console.warn(`[${key}] push error`, error)
    return false
  }

  function ensureInit() {
    if (!initialized) {
      initialized = true
      hydrate()
      // realtime
      const ch = supabase.channel(`app_state:${key}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, (payload) => {
          if (payload.new?.key !== key) return
          const incoming = asArray(payload.new?.data)
          // Merge server into cache in case we have local unpushed changes
          cache = mergeItems(cache, incoming)
          serverVersion = payload.new?.version ?? serverVersion
          notify()
        }).subscribe()
      // no explicit unsubscribe here (app lifetime)
    }
  }

  // Public API
  function get() { ensureInit(); return cache }
  function subscribe(cb) { ensureInit(); subs.add(cb); try { cb(cache) } catch {}; return () => subs.delete(cb) }

  function set(next) {
    ensureInit()
    // Require items with updatedAt—assign now if missing
    const stamped = asArray(next).map(it => it?.updatedAt ? it : { ...it, updatedAt: nowIso() })
    cache = stamped
    notify()
    push(stamped)
  }

  function patchItems(patchFn) {
    ensureInit()
    const next = asArray(cache).map(it => patchFn(it))
    set(next)
  }

  function add(item) {
    ensureInit()
    if (!item?.id) item = { ...item, id: String(Date.now()) }
    const stamped = { ...item, updatedAt: nowIso(), deleted: false }
    cache = [stamped, ...cache]
    notify()
    push(cache)
  }

  function softDelete(id) {
    ensureInit()
    const next = cache.map(it => it.id === id ? { ...it, deleted: true, updatedAt: nowIso() } : it)
    cache = next.filter(x => !x.deleted) // hide from UI immediately
    notify()
    push(next) // push the version with tombstone so it can't be resurrected
  }

  return { get, set, add, softDelete, subscribe }
}
