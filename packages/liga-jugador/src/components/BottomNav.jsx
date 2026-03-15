import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Swords, Trophy, Users } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Inicio' },
  { to: '/batallas', icon: Swords, label: 'Batallas' },
  { to: '/tabla', icon: Trophy, label: 'Tabla' },
  { to: '/tabla/equipos', icon: Users, label: 'Clan' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-gray-900/95 border-t border-slate-800 backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center flex-1 gap-0.5 text-xs transition-colors',
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300',
              ].join(' ')
            }
          >
            <Icon className="w-5 h-5" strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
