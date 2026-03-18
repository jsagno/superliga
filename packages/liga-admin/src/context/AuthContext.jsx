import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // <-- ajustá si tu path es otro

const AuthContext = createContext(null);
const ALLOWED_ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "SUPER_USER"]);
const AUTH_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchUserRole(userId) {
    if (!userId) {
      setRole(null);
      return null;
    }

    const { data, error } = await supabase
      .from("app_user")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("fetchUserRole error:", error);
      setRole(null);
      return null;
    }

    const nextRole = data?.role ?? null;
    setRole(nextRole);
    return nextRole;
  }

  useEffect(() => {
    let mounted = true;

    async function resolveRoleForSession(nextSession) {
      if (!mounted) return;

      setSession(nextSession ?? null);

      if (!nextSession?.user?.id) {
        setRole(null);
        return;
      }

      try {
        await withTimeout(
          fetchUserRole(nextSession.user.id),
          AUTH_TIMEOUT_MS,
          "fetchUserRole timeout",
        );
      } catch (err) {
        console.error("resolveRoleForSession error:", err);
        setRole(null);
      }
    }

    async function init() {
      setLoading(true);
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          "getSession timeout",
        );

        if (!mounted) return;

        if (error) {
          console.error("getSession error:", error);
          setSession(null);
          setRole(null);
        } else {
          await resolveRoleForSession(data.session ?? null);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("init auth error:", err);
        setSession(null);
        setRole(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setLoading(true);
      await resolveRoleForSession(newSession ?? null);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const isAdmin = !!role && ALLOWED_ADMIN_ROLES.has(role);
  const value = useMemo(() => ({ session, loading, role, isAdmin }), [session, loading, role, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}