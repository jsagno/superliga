import { supabase } from "../lib/supabaseClient";

export const ALLOWED_ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "SUPER_USER"]);

export function isAllowedAdminRole(role) {
  return ALLOWED_ADMIN_ROLES.has(role ?? "");
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data?.session ?? null;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      queryParams: { prompt: "select_account" },
      redirectTo: `${window.location.origin}/admin`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data?.subscription?.unsubscribe?.();
}

export async function resolveAdminIdentity(session) {
  const user = session?.user;
  if (!user) return null;

  const { data: appUser, error } = await supabase
    .from("app_user")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("app_user role fetch failed:", error);
    throw error;
  }

  const role = appUser?.role ?? null;

  return {
    appUserId: user.id,
    role,
    isAdmin: isAllowedAdminRole(role),
  };
}