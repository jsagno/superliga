import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../supabaseClient.js'
import { resolvePlayerIdentity, signOut } from '../services/authService.js'

const PlayerAuthContext = createContext(null)
const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const E2E_AUTH_STORAGE_KEY = 'ligaJugador:e2eAuth'
const E2E_ROLE_STORAGE_KEY = 'ligaJugador:e2eRole'
const E2E_APP_USER_ID = import.meta.env.VITE_E2E_APP_USER_ID ?? 'e2e-app-user'
const E2E_PLAYER_ID = import.meta.env.VITE_E2E_PLAYER_ID ?? 'e2e-player'

function readE2EAuthIdentity() {
  if (!E2E_AUTH_BYPASS_ENABLED || typeof window === 'undefined') return null

  const authMode = window.localStorage.getItem(E2E_AUTH_STORAGE_KEY)
  if (authMode !== 'authenticated') return null

  const role = window.localStorage.getItem(E2E_ROLE_STORAGE_KEY) ?? 'PLAYER'
  // SUPER_ADMIN in E2E has no player link by default
  const playerId = role === 'SUPER_ADMIN' ? null : E2E_PLAYER_ID

  return {
    session: { user: { id: E2E_APP_USER_ID } },
    appUserId: E2E_APP_USER_ID,
    playerId,
    role,
  }
}

/**
 * Auth states:
 *   'loading'      — initial check in progress
 *   'unauthenticated' — no Supabase session
 *   'resolving'    — session exists, resolving player identity
 *   'unauthorized' — session exists but no app_user_player link
 *   'authenticated' — session + player identity resolved
 */

export function PlayerAuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [appUserId, setAppUserId] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [role, setRole] = useState(null)
  const [error, setError] = useState(null)

  // ── Impersonation state ───────────────────────────────────────────────────
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonationTarget, setImpersonationTarget] = useState(null)

  const isSuperAdmin = role === 'SUPER_ADMIN'
  const effectivePlayerId = isImpersonating ? impersonationTarget?.playerId ?? null : playerId

  const startImpersonation = useCallback(({ playerId: targetPlayerId, name, seasonId }) => {
    if (!isSuperAdmin) return
    setImpersonationTarget({ playerId: targetPlayerId, name, seasonId })
    setIsImpersonating(true)
  }, [isSuperAdmin])

  const stopImpersonation = useCallback(() => {
    setIsImpersonating(false)
    setImpersonationTarget(null)
  }, [])
  // ─────────────────────────────────────────────────────────────────────────

  const handleSession = useCallback(async (newSession) => {
    if (!newSession) {
      setSession(null)
      setAppUserId(null)
      setPlayerId(null)
      setRole(null)
      setError(null)
      setIsImpersonating(false)
      setImpersonationTarget(null)
      setStatus('unauthenticated')
      return
    }

    setSession(newSession)
    setStatus('resolving')
    setError(null)

    try {
      const identity = await resolvePlayerIdentity(newSession)

      if (!identity) {
        // No app_user_player link and not SUPER_ADMIN — deny access and sign out
        await signOut()
        setSession(null)
        setAppUserId(null)
        setPlayerId(null)
        setRole(null)
        setStatus('unauthorized')
        return
      }

      setAppUserId(identity.appUserId)
      setPlayerId(identity.playerId)
      setRole(identity.role ?? 'PLAYER')
      setStatus('authenticated')
    } catch (err) {
      console.error('Player identity resolution error:', err)
      setError(err.message ?? 'Error al verificar identidad')
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    if (E2E_AUTH_BYPASS_ENABLED) {
      function syncE2EAuthState() {
        const identity = readE2EAuthIdentity()

        if (!identity) {
          setSession(null)
          setAppUserId(null)
          setPlayerId(null)
          setError(null)
          setStatus('unauthenticated')
          return
        }

        setSession(identity.session)
        setAppUserId(identity.appUserId)
        setPlayerId(identity.playerId)
        setRole(identity.role ?? 'PLAYER')
        setError(null)
        setStatus('authenticated')
      }

      syncE2EAuthState()
      window.addEventListener('storage', syncE2EAuthState)

      return () => {
        window.removeEventListener('storage', syncE2EAuthState)
      }
    }

    let mounted = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) {
        console.error('getSession error:', sessionError)
        setStatus('unauthenticated')
        return
      }
      handleSession(data.session ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) handleSession(newSession ?? null)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [handleSession])

  const value = useMemo(
    () => ({
      status,
      session,
      appUserId,
      playerId,
      effectivePlayerId,
      role,
      isSuperAdmin,
      isImpersonating,
      impersonationTarget,
      startImpersonation,
      stopImpersonation,
      error,
    }),
    [
      status, session, appUserId, playerId, effectivePlayerId,
      role, isSuperAdmin, isImpersonating, impersonationTarget,
      startImpersonation, stopImpersonation, error,
    ],
  )

  return (
    <PlayerAuthContext.Provider value={value}>
      {children}
    </PlayerAuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayerAuth() {
  const ctx = useContext(PlayerAuthContext)
  if (!ctx) throw new Error('usePlayerAuth must be used within PlayerAuthProvider')
  return ctx
}
