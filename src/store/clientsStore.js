// src/store/clientsStore.js
const STORAGE_KEY = "jag_clients";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sanitize(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const name = typeof c.name === "string" ? c.name.trim() : "";
      const entityType = c.entityType || "S-Corp";
      const notes = typeof c.notes === "string" ? c.notes : "";
      const years = Array.isArray(c.years) && c.years.length
        ? Array.from(new Set(c.years.map((y) => Number(y)).filter((n) => Number.isFinite(n))))
        : [new Date().getFullYear()];
      return { id: c.id || uid(), name, entityType, notes, years };
    })
    .filter((c) => c.name.length > 0);
}

export function getClients() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitize(JSON.parse(raw || "[]"));
  } catch {
    return [];
  }
}

export function setClients(next) {
  const cleaned = sanitize(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new CustomEvent("clients:updated"));
}

export function addClient({ name, entityType = "S-Corp", notes = "", taxYear = new Date().getFullYear() }) {
  const list = getClients();
  const entry = {
    id: uid(),
    name: String(name || "").trim(),
    entityType,
    notes,
    years: [Number(taxYear)],
  };
  if (!entry.name) return;
  list.unshift(entry);
  setClients(list);
}

export function updateClient(id, patch) {
  const list = getClients().map((c) => (c.id === id ? { ...c, ...patch } : c));
  setClients(list);
}

export function removeClient(id) {
  setClients(getClients().filter((c) => c.id !== id));
}

export function addPlanningYear(id, year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return;
  const updated = getClients().map((c) =>
    c.id === id ? { ...c, years: Array.from(new Set([...(c.years || []), y])).sort() } : c
  );
  setClients(updated);
}

export function removePlanningYear(id, year) {
  const y = Number(year);
  const updated = getClients().map((c) =>
    c.id === id ? { ...c, years: (c.years || []).filter((v) => Number(v) !== y) } : c
  );
  setClients(updated);
}

// Subscribe to updates (returns unsubscribe)
export function subscribe(callback) {
  // push current immediately
  try { callback(getClients()); } catch {}
  const handler = () => {
    try { callback(getClients()); } catch {}
  };
  window.addEventListener("clients:updated", handler);
  return () => window.removeEventListener("clients:updated", handler);
}