import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getSession,
  onAuthStateChange,
  resolveAdminIdentity,
  signOut,
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function handleSession(nextSession) {
    if (!nextSession) {
      setSession(null);
      setRole(null);
      setError(null);
      return;
    }

    setSession(nextSession);
    setError(null);

    try {
      const identity = await resolveAdminIdentity(nextSession);

      if (!identity?.isAdmin) {
        await signOut();
        setSession(null);
        setRole(null);
        setError("Acceso denegado. Rol administrativo requerido.");
        return;
      }

      setRole(identity.role);
    } catch (err) {
      console.error("Auth identity resolution error:", err);
      setSession(null);
      setRole(null);
      setError(err?.message ?? "Error al verificar identidad");
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      try {
        const currentSession = await getSession();
        if (!mounted) return;
        await handleSession(currentSession);
      } catch (err) {
        if (!mounted) return;
        console.error("init auth error:", err);
        setSession(null);
        setRole(null);
        setError(err?.message ?? "Error al inicializar autenticación");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const unsubscribe = onAuthStateChange(async (newSession) => {
      if (!mounted) return;
      setLoading(true);
      await handleSession(newSession ?? null);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const isAdmin = !!role;
  const user = session?.user ?? null;
  const value = useMemo(
    () => ({ session, user, loading, role, isAdmin, error }),
    [session, user, loading, role, isAdmin, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}