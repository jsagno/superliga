import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // <-- ajustá si tu path es otro

const AuthContext = createContext(null);
const ALLOWED_ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "SUPER_USER"]);

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

    async function init() {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        console.error("getSession error:", error);
        setSession(null);
        setRole(null);
      } else {
        const nextSession = data.session ?? null;
        setSession(nextSession);
        await fetchUserRole(nextSession?.user?.id ?? null);
      }
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession ?? null);
      await fetchUserRole(newSession?.user?.id ?? null);
      setLoading(false);
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