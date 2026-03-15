/* eslint-disable react-refresh/only-export-components -- router config file, not a hot-reload component */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginJugador from './pages/LoginJugador.jsx'

// Lazy-loaded screens (loaded on demand after login)
import { lazy, Suspense } from 'react'

const DashboardJugador = lazy(() => import('./pages/DashboardJugador.jsx'))
const TablaPosiciones = lazy(() => import('./pages/TablaPosiciones.jsx'))
const TablaEquipos = lazy(() => import('./pages/TablaEquipos.jsx'))
const BatallasPendientes = lazy(() => import('./pages/BatallasPendientes.jsx'))
const HistorialBatallas = lazy(() => import('./pages/HistorialBatallas.jsx'))

function LazyPage({ children }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-slate-400">
          Cargando…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

const router = createBrowserRouter([
  // Public route
  { path: '/login', element: <LoginJugador /> },

  // Protected routes
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <LazyPage>
            <DashboardJugador />
          </LazyPage>
        ),
      },
      {
        path: 'tabla',
        element: (
          <LazyPage>
            <TablaPosiciones />
          </LazyPage>
        ),
      },
      {
        path: 'tabla/equipos',
        element: (
          <LazyPage>
            <TablaEquipos />
          </LazyPage>
        ),
      },
      {
        path: 'batallas',
        element: (
          <LazyPage>
            <BatallasPendientes />
          </LazyPage>
        ),
      },
      {
        path: 'historial',
        element: (
          <LazyPage>
            <HistorialBatallas />
          </LazyPage>
        ),
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
])

export default router
