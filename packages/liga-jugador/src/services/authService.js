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
 * Returns { appUserId, playerId, role } on success.
 * - For PLAYER role: playerId is the linked player_id (null if not yet linked).
 * - For SUPER_ADMIN role: playerId is null (no player link required).
 * Returns null if no app_user row can be resolved.
 *
 * The upsert strategy uses ignoreDuplicates: true so that an existing admin
 * role is never accidentally overwritten to PLAYER on re-login.
 */
export async function resolvePlayerIdentity(session) {
  const user = session?.user
  if (!user) return null

  // 1. Insert app_user if not exists (ignoreDuplicates: true preserves existing role)
  const { error: upsertError } = await supabase
    .from('app_user')
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? null,
        role: 'PLAYER',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )

  if (upsertError) {
    console.error('app_user upsert failed:', upsertError)
    throw upsertError
  }

  // 2. Fetch actual role (may differ from the default 'PLAYER' we tried to insert)
  const { data: appUser, error: roleError } = await supabase
    .from('app_user')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (roleError) {
    console.error('app_user role fetch failed:', roleError)
    throw roleError
  }

  const role = appUser?.role ?? 'PLAYER'

  // 3. SUPER_ADMIN: allow access without a player link
  if (role === 'SUPER_ADMIN') {
    return { appUserId: user.id, playerId: null, role }
  }

  // 4. Check for app_user_player link (required for regular players)
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

  return { appUserId: user.id, playerId: link.player_id, role }
}
