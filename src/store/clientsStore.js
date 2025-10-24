// Clients shared store built on the generic shared doc.
// Keeps your existing API: getClients / setClients / addClient / subscribe
// Deletes use tombstones so stale clients can’t resurrect removed rows.

import { createSharedDoc } from '@/lib/sharedState'

const clientsDoc = createSharedDoc('clients', { initial: [] })

export function getClients() { return clientsDoc.get() }
export function setClients(next) { clientsDoc.set(next) }
export function addClient(client) { clientsDoc.add(client) }
export function deleteClient(id) { clientsDoc.softDelete(id) }
export function subscribe(cb) { return clientsDoc.subscribe(cb) }
