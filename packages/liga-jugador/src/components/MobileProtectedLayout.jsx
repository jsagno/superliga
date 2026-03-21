import React from 'react'

export default function MobileProtectedLayout({ children, nav, maxWidth = 'max-w-md' }) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-950 text-slate-200">
      <main className={`mx-auto flex h-full ${maxWidth} min-h-0 flex-col px-4 pb-24 pt-4`}>
        {children}
      </main>
      {nav}
    </div>
  )
}
