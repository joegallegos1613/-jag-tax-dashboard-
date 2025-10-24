// src/components/OwnersAdmin.jsx — CRUD for Owners (Supabase-backed via ownersStore)
import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  subscribeOwners,
  getOwners,
  addOwnerRow,
  updateOwnerRow,
  removeOwnerRow,
} from '@/store/ownersStore'

export default function OwnersAdmin(){
  const [owners, setOwners] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    const unsub = subscribeOwners(setOwners)
    setOwners(getOwners())
    return () => unsub()
  }, [])

  async function addOwner(){
    const n = name.trim()
    if (!n) return
    await addOwnerRow({ name: n, email: email.trim() || null, role: role.trim() || null })
    setName(''); setEmail(''); setRole('')
  }

  async function saveOwner(id, patch){
    await updateOwnerRow(id, patch)
  }

  async function deleteOwner(id){
    if (!confirm('Delete this owner?')) return
    await removeOwnerRow(id)
  }

  return (
    <div className="px-6 pb-10">
      <h2 className="text-2xl font-semibold mb-4">Owners Admin</h2>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <Input placeholder="Name *" value={name} onChange={e=>setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <Input placeholder="Role (optional)" value={role} onChange={e=>setRole(e.target.value)} />
            <Button onClick={addOwner}>+ Add Owner</Button>
          </div>
          <div className="text-xs text-gray-500">This list is your single source of truth. All owner drop-downs use these records.</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border">Name</th>
                <th className="text-left p-2 border">Email</th>
                <th className="text-left p-2 border">Role</th>
                <th className="text-left p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {owners.map(o => (
                <tr key={o.id} className="align-top">
                  <td className="p-2 border">
                    <Input defaultValue={o.name || ''} onBlur={(e)=>saveOwner(o.id, { name: e.target.value })} />
                  </td>
                  <td className="p-2 border">
                    <Input defaultValue={o.email || ''} onBlur={(e)=>saveOwner(o.id, { email: e.target.value || null })} />
                  </td>
                  <td className="p-2 border">
                    <Input defaultValue={o.role || ''} onBlur={(e)=>saveOwner(o.id, { role: e.target.value || null })} />
                  </td>
                  <td className="p-2 border">
                    <Button variant="destructive" onClick={()=>deleteOwner(o.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {owners.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-sm text-gray-600">No owners yet. Add one above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
