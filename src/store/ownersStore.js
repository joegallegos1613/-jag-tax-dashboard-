// Owners Single Source of Truth with the same conflict-safe mechanics.
// Use this one array for dropdowns and assignments everywhere.

import { createSharedDoc } from '@/lib/sharedState'

const ownersDoc = createSharedDoc('owners', { initial: [] })

export function getOwners() { return ownersDoc.get() }
export function setOwners(next) { ownersDoc.set(next) }
export function addOwner(owner) { ownersDoc.add(owner) }
export function deleteOwner(id) { ownersDoc.softDelete(id) }
export function subscribeOwners(cb) { return ownersDoc.subscribe(cb) }
