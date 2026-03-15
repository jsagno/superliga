import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'

/**
 * Wraps all protected routes.
 * - 'loading' / 'resolving' → spinner
 * - 'unauthenticated'       → redirect to /login
 * - 'unauthorized'          → redirect to /login (LoginJugador shows the rejection message)
 * - 'authenticated'         → render children via <Outlet />
 */
export default function ProtectedRoute() {
  const { status } = usePlayerAuth()

  if (status === 'loading' || status === 'resolving') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-sm">Verificando acceso…</span>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || status === 'unauthorized') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
