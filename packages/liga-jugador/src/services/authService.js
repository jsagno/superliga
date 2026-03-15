import { supabase } from '../supabaseClient.js'

/**
 * Signs in the user via Google OAuth popup.
 * Supabase handles token exchange and session creation.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { queryParams: { prompt: 'select_account' } },
  })
  if (error) throw error
}

/**
 * Signs out the current user and clears the session.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Returns the current session, or null if not authenticated.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Subscribes to auth state changes.
 * Returns the unsubscribe function.
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data?.subscription?.unsubscribe?.()
}

/**
 * After a successful OAuth login, ensures `app_user` exists (upsert)
 * and resolves the player link from `app_user_player`.
 *
 * Returns { appUserId, playerId } on success.
 * Returns null if no `app_user_player` link exists.
 *
 * The upsert strategy is key for bootstrap: the first time a player
 * authenticates, this creates their `app_user` row so the admin can
 * see it in liga-admin and create the `app_user_player` link.
 */
export async function resolvePlayerIdentity(session) {
  const user = session?.user
  if (!user) return null

  // 1. Upsert app_user — safe to run on every login
  const { error: upsertError } = await supabase
    .from('app_user')
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? null,
        role: 'PLAYER',
      },
      { onConflict: 'id', ignoreDuplicates: false },
    )

  if (upsertError) {
    console.error('app_user upsert failed:', upsertError)
    throw upsertError
  }

  // 2. Check for app_user_player link
  const { data: link, error: linkError } = await supabase
    .from('app_user_player')
    .select('player_id, linked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (linkError) {
    console.error('app_user_player lookup failed:', linkError)
    throw linkError
  }

  if (!link) return null

  return { appUserId: user.id, playerId: link.player_id }
}
