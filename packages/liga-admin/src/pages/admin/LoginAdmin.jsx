// src/pages/admin/LoginAdmin.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Eye, EyeOff, LogIn, Mail } from "lucide-react";

// Si ya tenés supabase configurado en /src/lib/supabase.js, descomentá:
 import { supabase } from "../../lib/supabaseClient";

export default function LoginAdmin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const logoStyle = useMemo(
    () => ({
      backgroundImage:
        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBd-HeHE1aMr3Gxw0hrF1Dq2FI21x36BdNUBdZ4JN-ZpQAvV1bMUav13_52NjYkXxk4poJEZ8xM3R6Fm2ywHS9UmYkiFK2oayMwWFdCs6MghfVGdxZ4-bm-PtLJfugfVVkds4SvlM8Poi4ynqS3e3aV-n2U99-2LaAkeUdHArMrpRDE5i8I7t_UD0MN87pV14hafpxpxPXlJ4zQFFhnD0_-Rv7nYqd8K-a6t79z6JjHhpMboiUgkKvOfr5g54UN_pibZHDH_bWKhBA")',
      backgroundSize: "cover",
      backgroundPosition: "center",
    }),
    []
  );

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
       const { data, error } = await supabase.auth.signInWithPassword({
         email,
         password,
       });
       if (error) throw error;
       if (!data?.session) throw new Error("No session returned.");

      // Opción simple por ahora:
      navigate("/admin");
    } catch (err) {
      setErrorMsg(err?.message || "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordRecovery(e) {
    e.preventDefault();
    setErrorMsg("");
    setRecoveryLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      
      if (error) throw error;
      
      setRecoverySuccess(true);
    } catch (err) {
      setErrorMsg(err?.message || "Error al enviar el email de recuperación.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleBackToLogin() {
    setShowRecovery(false);
    setRecoverySuccess(false);
    setRecoveryEmail("");
    setErrorMsg("");
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 py-10 bg-[#101622] text-white transition-colors">
      {/* Full-screen pattern / background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(#1152d4 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Container phone-like (centered card) */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#081222] shadow-2xl">

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between p-4 pt-6">
          <button
            type="button"
            onClick={() => showRecovery ? handleBackToLogin() : navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-10 w-10" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col px-6 pb-8 pt-4">
          {/* Branding */}
          <div className="mb-8 flex flex-col items-center justify-center">
            <div className="group relative mb-6 h-28 w-28">
              {/* Glow */}
              <div className="absolute inset-0 rounded-2xl bg-[#1152d4] blur-xl opacity-40 transition-opacity duration-500 group-hover:opacity-60" />
              {/* Logo */}
              <div
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#1A2230] shadow-lg"
                style={logoStyle}
              />
            </div>

            <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">
              {showRecovery ? "Recuperar Contraseña" : "Administración"}
            </h1>
            <p className="text-center text-sm font-medium text-slate-400">
              {showRecovery 
                ? "Te enviaremos un email para restablecer tu contraseña"
                : "Gestiona tu liga interna"}
            </p>
          </div>

          {/* Form */}
          {!showRecovery ? (
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Usuario / Email
                </label>
                <div className="flex h-14 w-full items-center overflow-hidden rounded-xl border border-slate-800 bg-[#1A2230] shadow-sm transition-all focus-within:border-[#1152d4] focus-within:ring-1 focus-within:ring-[#1152d4]">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
                    placeholder="nombre@ejemplo.com"
                    type="email"
                    autoComplete="email"
                    required
                  />
                  <div className="pr-4 text-slate-500">
                    <User size={20} />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contraseña
                </label>
                <div className="flex h-14 w-full items-center overflow-hidden rounded-xl border border-slate-800 bg-[#1A2230] shadow-sm transition-all focus-within:border-[#1152d4] focus-within:ring-1 focus-within:ring-[#1152d4]">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
                    placeholder="••••••••"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="pr-4 text-slate-500 transition-colors hover:text-[#1152d4]"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPwd ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>

              {/* Forgot */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-[#1152d4] transition-colors hover:text-blue-400"
                  onClick={() => setShowRecovery(true)}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="h-4" />

              {/* Error */}
              {errorMsg ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {errorMsg}
                </div>
              ) : null}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1152d4] font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span>{loading ? "Ingresando..." : "Iniciar Sesión"}</span>
                <LogIn size={20} />
              </button>
            </form>
          ) : (
            /* Recovery Form */
            <div className="flex w-full flex-col gap-5">
              {!recoverySuccess ? (
                <form onSubmit={handlePasswordRecovery} className="flex w-full flex-col gap-5">
                  {/* Recovery Email */}
                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Email de recuperación
                    </label>
                    <div className="flex h-14 w-full items-center overflow-hidden rounded-xl border border-slate-800 bg-[#1A2230] shadow-sm transition-all focus-within:border-[#1152d4] focus-within:ring-1 focus-within:ring-[#1152d4]">
                      <input
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        className="flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
                        placeholder="nombre@ejemplo.com"
                        type="email"
                        autoComplete="email"
                        required
                      />
                      <div className="pr-4 text-slate-500">
                        <Mail size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
                    Te enviaremos un enlace a tu email para que puedas restablecer tu contraseña.
                  </div>

                  {/* Error */}
                  {errorMsg ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                      {errorMsg}
                    </div>
                  ) : null}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1152d4] font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span>{recoveryLoading ? "Enviando..." : "Enviar Email"}</span>
                    <Mail size={20} />
                  </button>

                  {/* Back to login */}
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
                  >
                    Volver al inicio de sesión
                  </button>
                </form>
              ) : (
                /* Success Message */
                <div className="flex w-full flex-col gap-5">
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
                    <div className="mb-2 flex justify-center">
                      <div className="rounded-full bg-green-500/20 p-3">
                        <Mail size={32} className="text-green-400" />
                      </div>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-green-200">
                      Email Enviado
                    </h3>
                    <p className="text-sm text-green-300">
                      Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña en <strong>{recoveryEmail}</strong>
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                      Revisa tu bandeja de entrada y spam.
                    </p>
                  </div>

                  {/* Back to login */}
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-700 font-semibold text-white transition-all hover:bg-slate-600 active:scale-[0.98]"
                  >
                    <ArrowLeft size={20} />
                    <span>Volver al inicio de sesión</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-8 text-center">
            <p className="text-xs text-slate-600">Versión 1.2.0 • Admin Panel</p>
          </div>
        </div>
      </div>
    </div>
  );
}
