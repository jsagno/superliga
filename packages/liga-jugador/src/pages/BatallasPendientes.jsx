import React from 'react'
import BottomNav from '../components/BottomNav.jsx'

export default function BatallasPendientes() {
  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 pb-safe">
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Batallas Pendientes — próximamente
      </div>
      <BottomNav />
    </div>
  )
}
