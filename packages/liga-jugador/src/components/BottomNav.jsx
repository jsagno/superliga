import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Swords, Trophy, Users } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Inicio' },
  { to: '/batallas', icon: Swords, label: 'Batallas', badgeKey: 'pending' },
  { to: '/tabla', icon: Trophy, label: 'Tabla' },
  { to: '/tabla/equipos', icon: Users, label: 'Clan' },
]

export default function BottomNav({ pendingCount = 0 }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-gray-900/95 border-t border-slate-800 backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ to, icon: Icon, label, badgeKey }) => (
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
            <span className="relative">
              <Icon className="w-5 h-5" strokeWidth={2} />
              {badgeKey === 'pending' && pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] text-white leading-4 text-center">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
