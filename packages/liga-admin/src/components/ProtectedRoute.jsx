import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  if (!session) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return children;
}