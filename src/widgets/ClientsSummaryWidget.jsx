import React from "react";
import { getClients, subscribe } from "../store/clientsStore";

export default function ClientsSummaryWidget() {
  const [clients, setClients] = React.useState(getClients());

  React.useEffect(() => {
    // live updates whenever clients change anywhere in the app
    const unsub = subscribe(setClients);
    // refresh once on mount
    setClients(getClients());
    return unsub;
  }, []);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-600">Clients (live)</div>
      <div className="mt-1 text-2xl font-semibold">{clients.length}</div>

      {clients.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-gray-800 max-h-40 overflow-auto">
          {clients.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{c.name}</span>
              <span className="text-gray-500"> · {c.entityType}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
