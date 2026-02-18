import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import nophoto from "../../assets/nophoto.png";
function initialsFromName(name) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : (parts[0]?.[1] ?? "");
  return (a + (b || "")).toUpperCase();
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function TeamEdit() {
  const { teamId } = useParams();
  const isNew = teamId === "new";
  const nav = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState(""); // URL o path público

  const initials = useMemo(() => initialsFromName(name), [name]);
  const showImg = useMemo(() => {
    const s = (logo || "").trim();
    return s && isValidHttpUrl(s);
  }, [logo]);

  async function load() {
    if (isNew) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("team")
      .select("team_id,name,logo")
      .eq("team_id", teamId)
      .maybeSingle();

    if (error) {
      console.error(error);
      alert(`Error loading team: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      alert("Equipo no encontrado.");
      nav("/admin/teams");
      return;
    }

    setName(data.name ?? "");
    setLogo(data.logo ?? "");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function onSave(e) {
    e?.preventDefault?.();
    const n = name.trim();
    if (!n) {
      alert("El nombre es obligatorio.");
      return;
    }

    setSaving(true);

    const payload = {
      name: n,
      logo: (logo || "").trim() || null,
    };

    let res;
    if (isNew) {
      res = await supabase.from("team").insert(payload).select("team_id").single();
    } else {
      res = await supabase.from("team").update(payload).eq("team_id", teamId).select("team_id").single();
    }

    const { data, error } = res;
    if (error) {
      setSaving(false);
      alert(`Guardar falló: ${error.message}`);
      return;
    }

    setSaving(false);
    nav(`/admin/teams/${data.team_id}`);
  }

  async function onDelete() {
    if (isNew) {
      nav("/admin/teams");
      return;
    }
    if (!confirm("¿Eliminar este equipo?")) return;

    const { error } = await supabase.from("team").delete().eq("team_id", teamId);
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }
    nav("/admin/teams");
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, etc.)');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es muy grande. Máximo 5MB');
      return;
    }

    setUploading(true);

    try {
      // Verificar autenticación
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes estar autenticado para subir archivos');
        setUploading(false);
        return;
      }

      // Generar nombre único para el archivo
      const fileExt = file.name.split('.').pop();
      const fileName = `team_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `teams/${fileName}`;

      console.log('Uploading file:', filePath);

      // Subir archivo a Supabase Storage (bucket: ligakq)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ligakq')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        
        // Mensajes de error más específicos
        if (uploadError.message.includes('row-level security')) {
          alert('Error de permisos: El bucket necesita políticas de acceso configuradas.\n\nEn Supabase Dashboard → Storage → ligakq → Policies, crea una política:\n- INSERT: authenticated users can upload\n- SELECT: public can view');
        } else if (uploadError.message.includes('not found')) {
          alert('El bucket "ligakq" no existe. Créalo en Supabase Dashboard → Storage');
        } else {
          alert(`Error al subir archivo: ${uploadError.message}`);
        }
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('ligakq')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      setLogo(publicUrl);
      alert('Logo subido exitosamente');
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
      // Limpiar el input para permitir subir el mismo archivo de nuevo
      e.target.value = '';
    }
  }

  return (
    <div className="relative flex h-auto min-h-[calc(100dvh-0px)] w-full flex-col bg-slate-50 dark:bg-[#101622] overflow-x-hidden">
      {/* TopAppBar */}
      <div className="sticky top-0 z-50 bg-slate-50/80 dark:bg-[#101622]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#2d3748]">
        <div className="flex items-center p-4 justify-between h-16">
          <button
            onClick={() => nav(-1)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Volver"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
            {isNew ? "Nuevo Equipo" : "Editar Equipo"}
          </h2>

          <div className="size-10" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center w-full max-w-lg mx-auto p-4 gap-6">
        {loading ? (
          <div className="w-full text-slate-600 dark:text-slate-300">Cargando...</div>
        ) : (
          <>
            {/* ProfileHeader (Logo) */}
            <div className="flex w-full flex-col gap-4 items-center pt-2">
              <div className="flex gap-4 flex-col items-center relative group">
                <div className="relative">
                  <div className="rounded-full h-32 w-32 shadow-xl ring-4 ring-white dark:ring-[#1c2333] bg-white dark:bg-[#1c2333] overflow-hidden flex items-center justify-center">
                    
                      <img
                        alt="Logo del equipo"
                        src={logo.trim() || nophoto}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    
                  </div>

                  <div className="absolute bottom-0 right-0 bg-[#1152d4] text-white p-2 rounded-full shadow-lg ring-2 ring-slate-50 dark:ring-[#101622] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                      <path
                        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-2h6l2 2h4a2 2 0 0 1 2 2z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <p className="text-slate-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] text-center">
                    {name?.trim() ? name : "—"}
                  </p>
                  <p className="text-[#1152d4] font-medium text-sm leading-normal text-center mt-1">
                    Cargar / editar logo del equipo
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-slate-200 dark:bg-[#2d3748]" />

            {/* Form Fields */}
            <form onSubmit={onSave} className="w-full flex flex-col gap-5">
              {/* Nombre */}
              <div className="flex flex-col w-full gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                  Nombre del Equipo
                </label>
                <div className="relative">
                  <input
                    className="flex w-full min-w-0 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-[#2d3748] bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] h-14 placeholder:text-slate-400 dark:placeholder:text-slate-500 p-4 text-base font-normal leading-normal transition-all outline-none"
                    placeholder="Ej. Royale Kings"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </div>

              {/* Logo */}
              <div className="flex flex-col w-full gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                  Logo del Equipo
                </label>
                
                {/* Botón para subir archivo */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className={`flex w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-[#2d3748] h-14 px-4 transition-all cursor-pointer hover:border-[#1152d4] hover:bg-slate-50 dark:hover:bg-[#1c2333] ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 text-slate-500" fill="none">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                      {uploading ? 'Subiendo...' : 'Subir imagen desde tu computadora'}
                    </span>
                  </label>
                </div>

                <div className="text-center text-xs text-slate-500 dark:text-slate-400">o</div>

                {/* Input de URL manual */}
                <div className="relative">
                  <input
                    className="flex w-full min-w-0 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-[#2d3748] bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] h-14 placeholder:text-slate-400 dark:placeholder:text-slate-500 p-4 text-base font-normal leading-normal transition-all outline-none"
                    placeholder="Pega una URL del logo"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  Formatos aceptados: PNG, JPG, GIF (máx. 5MB). La imagen se sube a Supabase Storage.
                </p>
              </div>

              <div className="flex-1" />

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-3 pb-6 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full items-center justify-center rounded-xl bg-[#1152d4] h-12 px-5 transition-all hover:bg-blue-700 active:scale-[0.99] shadow-lg shadow-[#1152d4]/25 disabled:opacity-60"
                >
                  <span className="text-white text-base font-bold leading-normal">
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => nav("/admin/teams")}
                  className="flex w-full items-center justify-center rounded-xl bg-transparent border border-transparent h-12 px-5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                >
                  Cancelar
                </button>

                {!isNew && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="mt-2 flex w-full items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/10 h-10 px-5 transition-all hover:bg-red-100 dark:hover:bg-red-900/20 group"
                  >
                    <span className="text-red-600 dark:text-red-400 text-sm font-medium leading-normal group-hover:underline">
                      Eliminar este equipo
                    </span>
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      <div className="h-5 bg-slate-50 dark:bg-[#101622]" />
    </div>
  );
}
