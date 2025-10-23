import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const OwnersContext = createContext(null)

const initialState = {
  owners: [], // { id, name, email, role }
  deliverables: [], // { id, title, type, status, clientName, taxYear, ownerIds: [] }
}

function loadState() {
  try {
    const raw = localStorage.getItem('jag.owners.state.v1')
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return {
      owners: Array.isArray(parsed.owners) ? parsed.owners : [],
      deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    }
  } catch {
    return initialState
  }
}

function saveState(state) {
  localStorage.setItem('jag.owners.state.v1', JSON.stringify(state))
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      return { ...state, ...action.payload }
    }
    case 'ADD_OWNER': {
      const owners = [...state.owners, action.payload]
      return { ...state, owners }
    }
    case 'UPDATE_OWNER': {
      const owners = state.owners.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o)
      return { ...state, owners }
    }
    case 'DELETE_OWNER': {
      const owners = state.owners.filter(o => o.id !== action.payload)
      // also remove from any deliverables
      const deliverables = state.deliverables.map(d => ({
        ...d,
        ownerIds: (d.ownerIds || []).filter(id => id !== action.payload)
      }))
      return { ...state, owners, deliverables }
    }
    case 'ADD_DELIVERABLE': {
      const deliverables = [...state.deliverables, action.payload]
      return { ...state, deliverables }
    }
    case 'UPDATE_DELIVERABLE': {
      const deliverables = state.deliverables.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d)
      return { ...state, deliverables }
    }
    case 'DELETE_DELIVERABLE': {
      const deliverables = state.deliverables.filter(d => d.id !== action.payload)
      return { ...state, deliverables }
    }
    default:
      return state
  }
}

export function OwnersProvider({ children, seed }) {
  const [state, dispatch] = useReducer(reducer, initialState, loadState)

  // optional one‑time seeding on first run
  useEffect(() => {
    if (state.owners.length === 0 && state.deliverables.length === 0 && seed) {
      dispatch({ type: 'INIT', payload: seed })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  const api = useMemo(() => ({
    owners: state.owners,
    deliverables: state.deliverables,

    addOwner: (owner) => dispatch({ type: 'ADD_OWNER', payload: withId(owner) }),
    updateOwner: (owner) => dispatch({ type: 'UPDATE_OWNER', payload: owner }),
    deleteOwner: (ownerId) => dispatch({ type: 'DELETE_OWNER', payload: ownerId }),

    addDeliverable: (deliv) => dispatch({ type: 'ADD_DELIVERABLE', payload: withId({ ownerIds: [], ...deliv }) }),
    updateDeliverable: (deliv) => dispatch({ type: 'UPDATE_DELIVERABLE', payload: deliv }),
    deleteDeliverable: (id) => dispatch({ type: 'DELETE_DELIVERABLE', payload: id }),
  }), [state])

  return (
    <OwnersContext.Provider value={api}>{children}</OwnersContext.Provider>
  )
}

export function useOwners() {
  const ctx = useContext(OwnersContext)
  if (!ctx) throw new Error('useOwners must be used within <OwnersProvider>')
  return ctx
}

function withId(obj) {
  return { id: crypto.randomUUID(), ...obj }
}