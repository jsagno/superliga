// src/pages/admin/ResetPassword.jsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  const logoStyle = useMemo(
    () => ({
      backgroundImage:
        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBd-HeHE1aMr3Gxw0hrF1Dq2FI21x36BdNUBdZ4JN-ZpQAvV1bMUav13_52NjYkXxk4poJEZ8xM3R6Fm2ywHS9UmYkiFK2oayMwWFdCs6MghfVGdxZ4-bm-PtLJfugfVVkds4SvlM8Poi4ynqS3e3aV-n2U99-2LaAkeUdHArMrpRDE5i8I7t_UD0MN87pV14hafpxpxPXlJ4zQFFhnD0_-Rv7nYqd8K-a6t79z6JjHhpMboiUgkKvOfr5g54UN_pibZHDH_bWKhBA")',
      backgroundSize: "cover",
      backgroundPosition: "center",
    }),
    []
  );

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setIsValidSession(true);
      } else {
        setErrorMsg("Sesión inválida o expirada. Por favor, solicita un nuevo enlace de recuperación.");
      }
    };
    checkSession();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    // Validations
    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/admin/login");
      }, 3000);
    } catch (err) {
      setErrorMsg(err?.message || "Error al restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
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
        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col px-6 pb-8 pt-12">
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
              Nueva Contraseña
            </h1>
            <p className="text-center text-sm font-medium text-slate-400">
              Ingresa tu nueva contraseña
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
              {/* New Password */}
              <div className="space-y-2">
                <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nueva Contraseña
                </label>
                <div className="flex h-14 w-full items-center overflow-hidden rounded-xl border border-slate-800 bg-[#1A2230] shadow-sm transition-all focus-within:border-[#1152d4] focus-within:ring-1 focus-within:ring-[#1152d4]">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
                    placeholder="••••••••"
                    type={showPwd ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    disabled={!isValidSession}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="pr-4 text-slate-500 transition-colors hover:text-[#1152d4]"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    disabled={!isValidSession}
                  >
                    {showPwd ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Confirmar Contraseña
                </label>
                <div className="flex h-14 w-full items-center overflow-hidden rounded-xl border border-slate-800 bg-[#1A2230] shadow-sm transition-all focus-within:border-[#1152d4] focus-within:ring-1 focus-within:ring-[#1152d4]">
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
                    placeholder="••••••••"
                    type={showConfirmPwd ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    disabled={!isValidSession}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="pr-4 text-slate-500 transition-colors hover:text-[#1152d4]"
                    aria-label={showConfirmPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    disabled={!isValidSession}
                  >
                    {showConfirmPwd ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
                La contraseña debe tener al menos 6 caracteres.
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
                disabled={loading || !isValidSession}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1152d4] font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span>{loading ? "Actualizando..." : "Restablecer Contraseña"}</span>
                <Lock size={20} />
              </button>

              {/* Back to login */}
              <button
                type="button"
                onClick={() => navigate("/admin/login")}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Volver al inicio de sesión
              </button>
            </form>
          ) : (
            /* Success Message */
            <div className="flex w-full flex-col gap-5">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center">
                <div className="mb-3 flex justify-center">
                  <div className="rounded-full bg-green-500/20 p-4">
                    <CheckCircle size={48} className="text-green-400" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-green-200">
                  ¡Contraseña Actualizada!
                </h3>
                <p className="text-sm text-green-300">
                  Tu contraseña ha sido restablecida exitosamente.
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Serás redirigido al inicio de sesión en unos segundos...
                </p>
              </div>

              {/* Manual redirect */}
              <button
                type="button"
                onClick={() => navigate("/admin/login")}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1152d4] font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-600 active:scale-[0.98]"
              >
                <span>Ir al inicio de sesión</span>
              </button>
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
