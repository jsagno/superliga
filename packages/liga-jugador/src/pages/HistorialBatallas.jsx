import React from 'react'
import BottomNav from '../components/BottomNav.jsx'
import MobileProtectedLayout from '../components/MobileProtectedLayout.jsx'

export default function HistorialBatallas() {
  return (
    <MobileProtectedLayout nav={<BottomNav />}>
      <div className="flex min-h-0 flex-1 flex-col" data-testid="historial-scroll-root">
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Liga Interna</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-50">Historial de Batallas</h1>
        </header>

        <div data-testid="historial-scroll-content" className="min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="flex min-h-full items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/50 px-6 text-center text-sm text-slate-400">
            Historial de Batallas - proximamente
          </div>
        </div>
      </div>
    </MobileProtectedLayout>
  )
}
