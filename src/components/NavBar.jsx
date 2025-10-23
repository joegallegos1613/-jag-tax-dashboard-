import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const { pathname } = useLocation();
  const isActive = (p) => (pathname === p ? "text-black" : "text-gray-600 hover:text-black");
  return (
    <header className="bg-white border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold">JAG Dashboard</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/" className={isActive("/")}>Home</Link>
          <Link to="/clients" className={isActive("/clients")}>Clients</Link>
        </nav>
      </div>
    </header>
  );
}