// SPEC: docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md — RF-DASH-04
// Reusable component for a single stat in the 2×2 stats grid.

import React from 'react'

export default function StatsBadge({ icon, label, value, colorClass = 'text-slate-200' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-1">
      <span className="text-2xl leading-none">{icon}</span>
      <span className={`text-xl font-bold ${colorClass}`}>{value ?? '—'}</span>
      <span className="text-xs text-slate-400 text-center leading-tight">{label}</span>
    </div>
  )
}
