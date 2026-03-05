import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const Toast = ({ message, type = "info", onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  const bgColor = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  }[type] || "bg-blue-600";

  return (
    <div className={`${bgColor} text-white px-4 py-2 rounded mb-4 fixed bottom-4 right-4 z-50`}>
      {message}
    </div>
  );
};

export default function ZoneDiscordWebhooks() {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");
  const [zones, setZones] = useState([]);
  const [webhooks, setWebhooks] = useState({});
  const [toast, setToast] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState({
    webhook_url: "",
    is_active: true,
  });

  const selectedSeason = useMemo(() => {
    return seasons.find((s) => s.season_id === seasonId) || null;
  }, [seasons, seasonId]);

  // Load seasons on mount
  useEffect(() => {
    loadSeasons();
  }, []);

  // Load zones when season changes
  useEffect(() => {
    if (seasonId) {
      loadZones(seasonId);
    }
  }, [seasonId]);

  async function loadSeasons() {
    try {
      const { data, error } = await supabase
        .from("season")
        .select("season_id, description, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSeasons(data || []);

      if (!seasonId && data && data.length > 0) {
        setSeasonId(data[0].season_id);
      }
    } catch (error) {
      setToast({ message: `Error loading seasons: ${error.message}`, type: "error" });
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadZones(season_id) {
    if (!season_id) {
      setZones([]);
      setWebhooks({});
      return;
    }

    try {
      // Load zones
      const { data: zonesData, error: zonesErr } = await supabase
        .from("season_zone")
        .select("zone_id, name, zone_order")
        .eq("season_id", season_id)
        .order("zone_order", { ascending: true });

      if (zonesErr) throw zonesErr;
      setZones(zonesData || []);

      // Load webhooks
      const zoneIds = (zonesData || []).map((z) => z.zone_id);
      if (zoneIds.length > 0) {
        const { data: webhooksData, error: webhooksErr } = await supabase
          .from("zone_discord_webhook")
          .select("*")
          .in("zone_id", zoneIds);

        if (webhooksErr) throw webhooksErr;

        const webhookMap = {};
        (webhooksData || []).forEach((w) => {
          webhookMap[w.zone_id] = w;
        });
        setWebhooks(webhookMap);
      } else {
        setWebhooks({});
      }
    } catch (error) {
      setToast({ message: `Error loading zones: ${error.message}`, type: "error" });
      setZones([]);
      setWebhooks({});
    }
  }

  const handleOpenModal = (zoneId) => {
    const webhook = webhooks[zoneId];
    setEditingZoneId(zoneId);
    setForm({
      webhook_url: webhook?.webhook_url || "",
      is_active: webhook?.is_active !== false,
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingZoneId(null);
    setForm({ webhook_url: "", is_active: true });
  };

  async function handleSave() {
    if (!form.webhook_url.trim()) {
      setToast({ message: "Webhook URL is required", type: "error" });
      return;
    }

    if (!form.webhook_url.startsWith("https://discord.com/api/webhooks/")) {
      setToast({ message: "Invalid Discord webhook URL", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const existingWebhook = webhooks[editingZoneId];

      if (existingWebhook) {
        // Update existing
        const { error } = await supabase
          .from("zone_discord_webhook")
          .update({
            webhook_url: form.webhook_url,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("zone_discord_webhook_id", existingWebhook.zone_discord_webhook_id);

        if (error) throw error;
        setToast({ message: "Webhook updated successfully", type: "success" });
      } else {
        // Create new
        const user = (await supabase.auth.getSession()).data.session?.user;
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("zone_discord_webhook").insert([
          {
            zone_id: editingZoneId,
            webhook_url: form.webhook_url,
            is_active: form.is_active,
            created_by_admin_id: user.id,
          },
        ]);

        if (error) throw error;
        setToast({ message: "Webhook created successfully", type: "success" });
      }

      await loadZones(seasonId);
      handleCloseModal();
    } catch (error) {
      setToast({ message: `Error saving webhook: ${error.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(zoneId) {
    if (!window.confirm("Delete this webhook?")) return;

    try {
      const webhook = webhooks[zoneId];
      if (!webhook) return;

      const { error } = await supabase
        .from("zone_discord_webhook")
        .delete()
        .eq("zone_discord_webhook_id", webhook.zone_discord_webhook_id);

      if (error) throw error;
      setToast({ message: "Webhook deleted successfully", type: "success" });
      await loadZones(seasonId);
    } catch (error) {
      setToast({ message: `Error deleting webhook: ${error.message}`, type: "error" });
    }
  }

  async function handleTestConnection() {
    if (!form.webhook_url.trim()) {
      setToast({ message: "Webhook URL is required", type: "error" });
      return;
    }

    setTesting(true);
    try {
      const testEmbed = {
        title: "🧪 Prueba de Conexión",
        description: "Este es un mensaje de prueba desde LigaInterna",
        color: 0x00FFFF,
        fields: [
          {
            name: "Estado",
            value: "✅ Conexión exitosa",
            inline: false,
          },
        ],
        footer: {
          text: "LigaInterna Test Message",
        },
      };

      const response = await fetch(form.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [testEmbed] }),
      });

      if (response.status === 204) {
        setToast({ message: "✅ Webhook connection successful!", type: "success" });
      } else if (response.status === 401 || response.status === 404) {
        setToast({ message: "Invalid webhook URL or expired", type: "error" });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setToast({ message: `Connection test failed: ${error.message}`, type: "error" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-4">🔔 Configurar Webhooks de Discord</h1>
        <p className="text-slate-400">Configure URLs de webhooks de Discord para que cada zona reciba notificaciones automáticas cuando se completen duelos diarios.</p>
      </div>

      {/* Season selector */}
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Temporada</label>
        <select
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Seleccionar --</option>
          {seasons.map((s) => (
            <option key={s.season_id} value={s.season_id}>
              {s.description}
            </option>
          ))}
        </select>
      </div>

      {/* Zones table */}
      {selectedSeason && zones.length > 0 ? (
        <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Zona</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Estado</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Webhook URL</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {zones.map((zone) => {
                const webhook = webhooks[zone.zone_id];
                const isConfigured = !!webhook;
                const isActive = webhook?.is_active !== false;

                return (
                  <tr key={zone.zone_id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-100">{zone.name}</td>
                    <td className="px-4 py-3">
                      {!isConfigured ? (
                        <span className="inline-block px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">
                          Sin configurar
                        </span>
                      ) : isActive ? (
                        <span className="inline-block px-2 py-1 text-xs bg-green-900 text-green-300 rounded">
                          ✅ Activo
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs bg-yellow-900 text-yellow-300 rounded">
                          ⏸️ Desactivado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm truncate max-w-xs">
                      {webhook?.webhook_url ? (
                        <code className="text-xs bg-slate-800 px-2 py-1 rounded">
                          {webhook.webhook_url.substring(0, 50)}...
                        </code>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenModal(zone.zone_id)}
                        className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        {isConfigured ? "Editar" : "Configurar"}
                      </button>
                      {isConfigured && (
                        <button
                          onClick={() => handleDelete(zone.zone_id)}
                          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : selectedSeason ? (
        <div className="text-slate-400 text-center py-8">No zones found for this season</div>
      ) : null}

      {/* Modal */}
      {modalOpen && editingZoneId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-100">
              {webhooks[editingZoneId] ? "Editar Webhook" : "Crear Webhook"}
            </h2>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">URL del Webhook de Discord</label>
              <input
                type="password"
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 bg-slate-800 text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Obtén esta URL en Discord:右键 en el canal → Editar canal → Integraciones → Webhooks
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-slate-300">
                Activar webhook
              </label>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testing || !form.webhook_url}
              className="w-full px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 rounded transition-colors"
            >
              {testing ? "Probando..." : "🧪 Prueba de Conexión"}
            </button>

            <div className="flex gap-2 pt-4 border-t border-slate-700">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white rounded transition-colors font-medium"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={handleCloseModal}
                disabled={saving}
                className="flex-1 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
