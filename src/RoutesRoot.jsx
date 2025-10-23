import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx"; // your existing app (unchanged)
import ClientManager from "./components/ClientManager.jsx";
import NavBar from "./components/NavBar.jsx";
import "./index.css"; // ensure Tailwind is loaded once at the top level

export default function RoutesRoot() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL || "/"}>
      <div className="min-h-screen bg-gray-100">
        <NavBar />
        <main className="pt-4">
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/clients" element={<ClientManager />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
