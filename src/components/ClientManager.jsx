import React, { useEffect, useMemo, useState } from "react";
import {
  getClients,
  addClient,
  updateClient,
  removeClient,
  addPlanningYear,
  subscribe,
} from "../store/clientsStore";

// Added "Individual" to the list
const ENTITY_TYPES = [
  "Individual",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "LLC (Disregarded)",
  "Sole Prop",
  "Trust/Estate",
  "Other",
];

export default function ClientManager() {
  const [clients, setClients] = useState(getClients());

  // keep in sync with any changes coming from other parts of the app
  useEffect(() => {
    const unsub = subscribe(setClients);
    setClients(getClients());
    return unsub;
  }, []);

  const [newClient, setNewClient] = useState({
    entityType: "Individual",
    name: "",
    notes: "",
    taxYear: new Date().getFullYear(),
  });

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ entityType: "", name: "", notes: "" });
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All");

  const isEditing = (id) => editingId === id;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    addClient({
      name: newClient.name,
      entityType: newClient.entityType,
      notes: newClient.notes,
      taxYear: newClient.taxYear,
    });
    setNewClient({ entityType: "Individual", name: "", notes: "", taxYear: new Date().getFullYear() });
  };

  const startEdit = (client) => {
    setEditingId(client.id);
    setDraft({ entityType: client.entityType, name: client.name, notes: client.notes || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ entityType: "", name: "", notes: "" });
  };

  const saveEdit = (id) => {
    const name = draft.name.trim();
    if (!name) return;
    updateClient(id, { ...draft, name });
    cancelEdit();
  };

  const onRemove = (id) => {
    removeClient(id);
    if (editingId === id) cancelEdit();
  };

  const yearOptions = useMemo(() => {
    const set = new Set();
    clients.forEach((c) => (c.years || []).forEach((y) => set.add(Number(y))));
    return ["All", ...Array.from(set).sort()];
  }, [clients]);

  const filtered = useMemo(() => {
    let base = clients;
    if (query.trim()) {
      const q = query.toLowerCase();
      base = base.filter((c) => [c.name, c.entityType, c.notes].some((v) => (v || "").toLowerCase().includes(q)));
    }
    if (yearFilter !== "All") {
      base = base.filter((c) => (c.years || []).map(String).includes(String(yearFilter)));
    }
    return base;
  }, [clients, query, yearFilter]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Client Manager</h1>
      <p className="mt-1 text-sm text-gray-600">Add clients; edit Entity Type, Client Name, Notes, and manage Tax Years.</p>

      {/* Add Client Card */}
      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">Add New Client</h2>
        <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Entity Type</label>
            <select
              className="rounded-xl border p-2 focus:outline-none focus:ring"
              value={newClient.entityType}
              onChange={(e) => setNewClient((s) => ({ ...s, entityType: e.target.value }))}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Client Name</label>
            <input
              className="rounded-xl border p-2 focus:outline-none focus:ring"
              placeholder="e.g., Riverstone Ventures LLC"
              value={newClient.name}
              onChange={(e) => setNewClient((s) => ({ ...s, name: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Initial Tax Year</label>
            <input
              type="number"
              min="2000"
              max="2100"
              className="rounded-xl border p-2 focus:outline-none focus:ring"
              value={newClient.taxYear}
              onChange={(e) => setNewClient((s) => ({ ...s, taxYear: Number(e.target.value) || new Date().getFullYear() }))}
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              className="min-h-[80px] rounded-xl border p-2 focus:outline-none focus:ring"
              placeholder="Any general notes about this client..."
              value={newClient.notes}
              onChange={(e) => setNewClient((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-2xl bg-black px-4 py-2 text-white shadow hover:opacity-90">Add Client</button>
          </div>
        </form>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex items-center gap-3">
        <input
          className="w-full rounded-2xl border p-2 focus:outline-none focus:ring"
          placeholder="Search by name, entity type, or note..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded-2xl border p-2 focus:outline-none focus:ring"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y === "All" ? "All Years" : y}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {/* Clients Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-3">Entity Type</th>
              <th className="px-4 py-3">Client Name</th>
              <th className="px-4 py-3">Tax Years</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No clients yet.</td></tr>
            )}
            {filtered.map((client) => (
              <tr key={client.id} className="border-t align-top">
                <td className="px-4 py-3">
                  {isEditing(client.id) ? (
                    <select className="w-full rounded-xl border p-2 focus:outline-none focus:ring" value={draft.entityType} onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value }))}>
                      {ENTITY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{client.entityType}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing(client.id) ? (
                    <input className="w-full rounded-xl border p-2 focus:outline-none focus:ring" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                  ) : (
                    <div className="font-medium">{client.name}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    {(client.years || []).map((y) => (
                      <span key={y} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{y}</span>
                    ))}
                    <YearAdder clientId={client.id} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isEditing(client.id) ? (
                    <textarea className="w-full min-h-[70px] rounded-xl border p-2 focus:outline-none focus:ring" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Add general notes..." />
                  ) : (
                    <div className="max-w-prose whitespace-pre-wrap text-gray-700">{client.notes || <span className="text-gray-400">—</span>}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing(client.id) ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => saveEdit(client.id)} className="rounded-xl bg-black px-3 py-1.5 text-white hover:opacity-90">Save</button>
                      <button onClick={cancelEdit} className="rounded-xl border px-3 py-1.5 hover:bg-gray-50">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(client)} className="rounded-xl border px-3 py-1.5 hover:bg-gray-50">Edit</button>
                      <button onClick={() => onRemove(client.id)} className="rounded-xl border px-3 py-1.5 text-red-600 hover:bg-red-50" title="Remove client">Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Helper / Import-Export */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button className="rounded-2xl border px-4 py-2 hover:bg-gray-50" onClick={() => { const text = JSON.stringify(clients, null, 2); navigator.clipboard.writeText(text); alert("Client list copied to clipboard as JSON."); }}>Copy Clients as JSON</button>
        <button className="rounded-2xl border px-4 py-2 hover:bg-gray-50" onClick={() => { const raw = prompt("Paste JSON to replace clients:"); if (!raw) return; try { const arr = JSON.parse(raw); if (!Array.isArray(arr)) throw new Error("Invalid format"); localStorage.setItem("jag_clients", JSON.stringify(arr)); window.dispatchEvent(new CustomEvent("clients:updated")); } catch { alert("Invalid JSON."); } }}>Replace from JSON</button>
      </div>
    </div>
  );
}

function YearAdder({ clientId }) {
  const [val, setVal] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!val) return;
        addPlanningYear(clientId, Number(val));
        setVal("");
      }}
      className="flex items-center gap-2"
      title="Add a tax year"
    >
      <input
        type="number"
        min="2000"
        max="2100"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-24 rounded-xl border px-2 py-1"
        placeholder="Year"
      />
      <button className="rounded-xl border px-2 py-1 text-xs hover:bg-gray-50" type="submit">+ Year</button>
    </form>
  );
}