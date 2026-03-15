import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gamepad2, Lock, Chrome } from 'lucide-react'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import { signInWithGoogle } from '../services/authService.js'

const APP_VERSION = '1.0.0'

export default function LoginJugador() {
  const { status } = usePlayerAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)

  // RF-LOGIN-03: redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true })
    }
  }, [status, navigate])

  // Show the "unauthorized" message when the context has already signed out the user
  const isUnauthorized = status === 'unauthorized'

  async function handleGoogleLogin() {
    if (loading) return
    setLoading(true)
    setLoginError(null)
    try {
      await signInWithGoogle()
      // OAuth redirect/popup — Supabase will trigger onAuthStateChange
    } catch {
      setLoginError('No se pudo iniciar la sesión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-10">
      {/* Hero section */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl p-5">
          <Gamepad2 className="w-14 h-14 text-blue-400" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Bienvenido a la Arena
          </h1>
          <p className="mt-1 text-slate-400 text-base">
            Liga Interna de Clash Royale
          </p>
        </div>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Unauthorized message (after sign-out by context) */}
        {isUnauthorized && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-300 text-center">
            Acceso Restringido — tu cuenta Google no está vinculada a ningún
            jugador autorizado.
          </div>
        )}

        {/* Generic login error */}
        {loginError && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300 text-center">
            {loginError}
          </div>
        )}

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading || status === 'resolving'}
          className="flex items-center justify-center gap-3 w-full rounded-xl bg-white hover:bg-gray-100 active:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-5 py-3.5 font-medium text-gray-800 text-base shadow-md"
        >
          {loading || status === 'resolving' ? (
            <svg
              className="animate-spin h-5 w-5 text-gray-500"
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
          ) : (
            <Chrome className="w-5 h-5 text-blue-500 flex-shrink-0" />
          )}
          <span>
            {loading || status === 'resolving'
              ? 'Verificando…'
              : 'Continuar con Google'}
          </span>
        </button>

        {/* Access restriction notice */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-4 flex gap-3">
          <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Acceso Restringido
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Para ingresar, tu correo de Google debe haber sido autorizado
              previamente por un administrador de la liga.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-xs text-slate-600 text-center">
        v{APP_VERSION} &bull; Powered by Internal League System
      </footer>
    </div>
  )
}
