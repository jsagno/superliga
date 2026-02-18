import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm ${
    isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
  }`;

export default function AdminLayout() {
  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="w-full px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-wide">Liga Admin</div>

          <nav className="flex gap-2">
            <NavLink to="/admin/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/players" className={navLinkClass}>
              Jugadores
            </NavLink>
            <NavLink to="/admin/teams" className={navLinkClass}>
              Equipos
            </NavLink>
            <NavLink to="/admin/eras" className={navLinkClass}>
              Eras
            </NavLink>
            <NavLink to="/admin/seasons" className={navLinkClass}>
              Temporadas
            </NavLink>
            <NavLink to="/admin/battles-history" className={navLinkClass}>
              Historial de Batallas
            </NavLink>

          </nav>

          <button
            className="text-sm px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}