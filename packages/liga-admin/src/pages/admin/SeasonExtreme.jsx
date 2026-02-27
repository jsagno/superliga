import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Componente para una carta sorteable
function SortableCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.card_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const iconUrl = card.raw_payload?.iconUrls?.medium || null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-move hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
    >
      {iconUrl ? (
        <img src={iconUrl} alt={card.name} className="w-12 h-12 rounded-md object-contain" />
      ) : (
        <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-xs text-gray-500">?</span>
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-white">{card.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {card.card_id}</div>
      </div>
      <span className="material-symbols-outlined text-gray-400">drag_indicator</span>
    </div>
  );
}

// Componente para mostrar la carta en el overlay
function CardDragOverlay({ card }) {
  if (!card) return null;

  const iconUrl = card.raw_payload?.iconUrls?.medium || null;

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 shadow-xl">
      {iconUrl ? (
        <img src={iconUrl} alt={card.name} className="w-12 h-12 rounded-md object-contain" />
      ) : (
        <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-xs text-gray-500">?</span>
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-white">{card.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {card.card_id}</div>
      </div>
    </div>
  );
}

export default function SeasonExtreme() {
  const { seasonId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [season, setSeason] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [playersByTeam, setPlayersByTeam] = useState({}); // Mapeo de team_id -> [player_ids]

  // Configuración de participantes por equipo
  const [extremeParticipants, setExtremeParticipants] = useState({});
  const [riskyParticipants, setRiskyParticipants] = useState({});

  // Cartas seleccionadas para extreme deck (8 cartas)
  const [extremeDeck, setExtremeDeck] = useState([]);
  const [activeCardId, setActiveCardId] = useState(null);

  // Flag to disable extreme configuration for this season
  const [isExtremeConfigDisabled, setIsExtremeConfigDisabled] = useState(false);

  // Búsqueda de cartas
  const [cardSearch, setCardSearch] = useState("");
  const [filteredCards, setFilteredCards] = useState([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, [seasonId]);

  useEffect(() => {
    if (cardSearch.trim()) {
      const search = cardSearch.toLowerCase();
      setFilteredCards(
        allCards.filter(
          (c) =>
            c.name.toLowerCase().includes(search) ||
            c.card_id.toString().includes(search)
        )
      );
    } else {
      setFilteredCards([]);
    }
  }, [cardSearch, allCards]);

  async function loadData() {
    setLoading(true);
    try {
      // Cargar temporada
      const { data: seasonData, error: seasonError } = await supabase
        .from("season")
        .select("*")
        .eq("season_id", seasonId)
        .single();

      if (seasonError) throw seasonError;
      setSeason(seasonData);
      
      // Load the extreme config disable flag
      setIsExtremeConfigDisabled(seasonData?.is_extreme_config_disabled || false);

      // Cargar equipos de la temporada (asumiendo que hay una tabla season_team o similar)
      // Por ahora cargaremos todos los equipos
      const { data: teamsData, error: teamsError } = await supabase
        .from("team")
        .select("*")
        .order("name");

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // Cargar jugadores
      const { data: playersData, error: playersError } = await supabase
        .from("player")
        .select("*")
        .order("nick");

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Cargar relación jugadores-equipos para esta temporada
      // Primero obtener todas las zonas de la temporada
      const { data: zonesData, error: zonesError } = await supabase
        .from("season_zone")
        .select("zone_id")
        .eq("season_id", seasonId);

      if (zonesError) throw zonesError;
      const zoneIds = (zonesData || []).map(z => z.zone_id);

      if (zoneIds.length > 0) {
        // Obtener asignaciones de jugadores por equipo en estas zonas
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("season_zone_team_player")
          .select("team_id, player_id")
          .in("zone_id", zoneIds);

        if (assignmentsError) throw assignmentsError;

        // Organizar jugadores por equipo
        const teamPlayerMap = {};
        (assignmentsData || []).forEach(assignment => {
          if (!teamPlayerMap[assignment.team_id]) {
            teamPlayerMap[assignment.team_id] = [];
          }
          if (!teamPlayerMap[assignment.team_id].includes(assignment.player_id)) {
            teamPlayerMap[assignment.team_id].push(assignment.player_id);
          }
        });

        setPlayersByTeam(teamPlayerMap);
      } else {
        setPlayersByTeam({});
      }

      // Cargar todas las cartas
      const { data: cardsData, error: cardsError } = await supabase
        .from("card")
        .select("*")
        .order("name");

      if (cardsError) throw cardsError;
      setAllCards(cardsData || []);

      // Cargar configuración extreme existente
      const { data: configData, error: configError } = await supabase
        .from("season_extreme_config")
        .select("*")
        .eq("season_id", seasonId)
        .single();

      if (configError && configError.code !== "PGRST116") {
        // PGRST116 = no rows, es OK si no existe aún
        console.error("Error loading config:", configError);
      }

      // Si existe config, cargar las cartas del deck
      if (configData?.extreme_deck_cards) {
        const cardIds = configData.extreme_deck_cards;
        const deckCards = cardsData.filter((c) => cardIds.includes(c.card_id));
        // Ordenar según el orden guardado
        const orderedDeck = cardIds
          .map((id) => deckCards.find((c) => c.card_id === id))
          .filter(Boolean);
        setExtremeDeck(orderedDeck);
      } else {
        setExtremeDeck([]);
      }

      // Cargar participantes existentes
      const { data: participantsData, error: participantsError } = await supabase
        .from("season_extreme_participant")
        .select("*")
        .eq("season_id", seasonId);

      if (participantsError) {
        console.error("Error loading participants:", participantsError);
      }

      // Organizar participantes por equipo y tipo
      const extremeByTeam = {};
      const riskyByTeam = {};

      (participantsData || []).forEach((p) => {
        if (p.participant_type === "EXTREMER") {
          extremeByTeam[p.team_id] = {
            player_id: p.player_id,
            start_date: p.start_date,
            end_date: p.end_date || "",
            id: p.season_extreme_participant_id,
          };
        } else if (p.participant_type === "RISKY") {
          if (!riskyByTeam[p.team_id]) {
            riskyByTeam[p.team_id] = [];
          }
          riskyByTeam[p.team_id].push({
            player_id: p.player_id,
            start_date: p.start_date,
            end_date: p.end_date || "",
            id: p.season_extreme_participant_id,
          });
        }
      });

      setExtremeParticipants(extremeByTeam);
      setRiskyParticipants(riskyByTeam);
    } catch (error) {
      console.error("Error loading data:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleDragStart(event) {
    setActiveCardId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setExtremeDeck((items) => {
        const oldIndex = items.findIndex((item) => item.card_id === active.id);
        const newIndex = items.findIndex((item) => item.card_id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveCardId(null);
  }

  function addCardToDeck(card) {
    if (extremeDeck.length >= 24) {
      alert("El mazo extreme solo puede tener 24 cartas (3 mazos de 8)");
      return;
    }
    if (extremeDeck.find((c) => c.card_id === card.card_id)) {
      alert("Esta carta ya está en el mazo");
      return;
    }
    setExtremeDeck([...extremeDeck, card]);
    setCardSearch("");
  }

  function removeCardFromDeck(cardId) {
    setExtremeDeck(extremeDeck.filter((c) => c.card_id !== cardId));
  }

  function updateExtremeParticipant(teamId, participantData) {
    setExtremeParticipants({
      ...extremeParticipants,
      [teamId]: participantData,
    });
  }

  function addRiskyParticipant(teamId, participantData) {
    const current = riskyParticipants[teamId] || [];
    if (current.length >= 2) {
      alert("Solo puede haber hasta 2 participantes Risky por equipo");
      return;
    }
    setRiskyParticipants({
      ...riskyParticipants,
      [teamId]: [...current, participantData],
    });
  }

  function removeRiskyParticipant(teamId, index) {
    const current = riskyParticipants[teamId] || [];
    setRiskyParticipants({
      ...riskyParticipants,
      [teamId]: current.filter((_, i) => i !== index),
    });
  }

  // Obtener jugadores de un equipo específico
  function getTeamPlayers(teamId) {
    const playerIds = playersByTeam[teamId] || [];
    return players.filter(p => playerIds.includes(p.player_id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // 1. Update season with extreme config disable flag
      const { error: seasonUpdateError } = await supabase
        .from("season")
        .update({
          is_extreme_config_disabled: isExtremeConfigDisabled,
        })
        .eq("season_id", seasonId);

      if (seasonUpdateError) throw seasonUpdateError;

      // 2. Guardar configuración del mazo extreme
      const deckCardIds = extremeDeck.map((c) => c.card_id);
      
      if (deckCardIds.length > 24) {
        alert("El mazo extreme no puede tener más de 24 cartas");
        setSaving(false);
        return;
      }

      const { error: configError } = await supabase
        .from("season_extreme_config")
        .upsert(
          {
            season_id: seasonId,
            extreme_deck_cards: deckCardIds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "season_id" }
        );

      if (configError) throw configError;

      // 3. Eliminar participantes existentes para esta temporada
      const { error: deleteError } = await supabase
        .from("season_extreme_participant")
        .delete()
        .eq("season_id", seasonId);

      if (deleteError) throw deleteError;

      // 4. Insertar nuevos participantes
      const participantsToInsert = [];

      // Agregar Extremers
      Object.entries(extremeParticipants).forEach(([teamId, data]) => {
        if (data.player_id && data.start_date) {
          participantsToInsert.push({
            season_id: seasonId,
            team_id: teamId,
            player_id: data.player_id,
            participant_type: "EXTREMER",
            start_date: data.start_date,
            end_date: data.end_date || null,
          });
        }
      });

      // Agregar Risky
      Object.entries(riskyParticipants).forEach(([teamId, dataArray]) => {
        dataArray.forEach((data) => {
          if (data.player_id && data.start_date) {
            participantsToInsert.push({
              season_id: seasonId,
              team_id: teamId,
              player_id: data.player_id,
              participant_type: "RISKY",
              start_date: data.start_date,
              end_date: data.end_date || null,
            });
          }
        });
      });

      // Validar restricciones antes de insertar
      const teamExtremersCount = {};
      const teamRiskyCount = {};

      participantsToInsert.forEach((p) => {
        if (p.participant_type === "EXTREMER") {
          teamExtremersCount[p.team_id] = (teamExtremersCount[p.team_id] || 0) + 1;
        } else {
          teamRiskyCount[p.team_id] = (teamRiskyCount[p.team_id] || 0) + 1;
        }
      });

      // Validar que ningún equipo tenga más de 1 Extremer o más de 2 Risky
      const invalidExtremers = Object.entries(teamExtremersCount).filter(([, count]) => count > 1);
      const invalidRisky = Object.entries(teamRiskyCount).filter(([, count]) => count > 2);

      if (invalidExtremers.length > 0) {
        alert("Error: Un equipo no puede tener más de 1 Extremer");
        setSaving(false);
        return;
      }

      if (invalidRisky.length > 0) {
        alert("Error: Un equipo no puede tener más de 2 Risky");
        setSaving(false);
        return;
      }

      if (participantsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("season_extreme_participant")
          .insert(participantsToInsert);

        if (insertError) throw insertError;
      }

      alert("✅ Configuración guardada exitosamente");
      await loadData(); // Recargar datos
    } catch (error) {
      console.error("Error saving:", error);
      alert(`❌ Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  const activeCard = activeCardId ? extremeDeck.find((c) => c.card_id === activeCardId) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#101622] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#101622]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#1e2736] border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/admin/seasons`)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Configuración Extreme
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {season?.description || "Temporada"}
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-xl">save</span>
            <span>{saving ? "Guardando..." : "Guardar"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Explicación */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h2 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            ℹ️ Modo Extreme
          </h2>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p>
              • <strong>Mazo Extreme:</strong> 24 cartas en total (3 mazos de 8 cartas cada uno) disponibles para usar durante la temporada.
            </p>
            <p>
              • <strong>Extremer:</strong> 1 participante por equipo que debe usar el mazo extreme en 2 o 3 rondas según el resultado.
            </p>
            <p>
              • <strong>Risky:</strong> Hasta 2 participantes por equipo con un mazo extreme menos restrictivo (pueden usarlo en 1-2 rondas).
            </p>
            <p>
              • Las fechas de inicio/fin permiten dar de alta o baja a los participantes cuando sea necesario.
            </p>
          </div>
        </div>

        {/* Disable Extreme Configuration Toggle */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="disableExtremeConfig"
              checked={isExtremeConfigDisabled}
              onChange={(e) => setIsExtremeConfigDisabled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <div className="flex-1">
              <label htmlFor="disableExtremeConfig" className="font-semibold text-yellow-900 dark:text-yellow-200 cursor-pointer">
                Deshabilitar Configuración Extreme para esta temporada
              </label>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                Cuando está habilitado, el histórico de batallas no mostrará validaciones de mazos extreme/risky.
              </p>
            </div>
          </div>
        </div>

        {/* Sección: Mazo Extreme */}
        <section className="bg-white dark:bg-[#1e2736] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500">playing_cards</span>
            Mazo Extreme (24 cartas = 3 mazos de 8)
          </h2>

          {/* Búsqueda de cartas */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buscar y agregar cartas
            </label>
            <div className="relative">
              <input
                type="text"
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Buscar por nombre o ID..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {cardSearch && (
                <button
                  onClick={() => setCardSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              )}
            </div>

            {/* Resultados de búsqueda */}
            {filteredCards.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                {filteredCards.slice(0, 20).map((card) => {
                  const iconUrl = card.raw_payload?.iconUrls?.medium || null;
                  const isInDeck = extremeDeck.find((c) => c.card_id === card.card_id);

                  return (
                    <button
                      key={card.card_id}
                      onClick={() => addCardToDeck(card)}
                      disabled={isInDeck}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      {iconUrl ? (
                        <img src={iconUrl} alt={card.name} className="w-10 h-10 rounded object-contain" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-xs text-gray-500">?</span>
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 dark:text-white">{card.name}</div>
                        <div className="text-xs text-gray-500">ID: {card.card_id}</div>
                      </div>
                      {isInDeck && (
                        <span className="text-green-500 text-sm">✓ En mazo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mazo actual con drag and drop */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Cartas seleccionadas ({extremeDeck.length}/24)
              </h3>
              {extremeDeck.length > 0 && (
                <button
                  onClick={() => setExtremeDeck([])}
                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Limpiar todas
                </button>
              )}
            </div>

            {extremeDeck.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                No hay cartas seleccionadas. Usa el buscador de arriba para agregar cartas.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={extremeDeck.map((c) => c.card_id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {extremeDeck.map((card) => (
                      <div key={card.card_id} className="relative group">
                        <SortableCard card={card} />
                        <button
                          onClick={() => removeCardFromDeck(card.card_id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  <CardDragOverlay card={activeCard} />
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </section>

        {/* Sección: Participantes por Equipo */}
        <section className="bg-white dark:bg-[#1e2736] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">groups</span>
            Participantes por Equipo
          </h2>

          <div className="space-y-6">
            {teams.map((team) => (
              <div
                key={team.team_id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  {team.name}
                </h3>

                {/* Extremer */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🔥 Extremer (1 jugador)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={extremeParticipants[team.team_id]?.player_id || ""}
                      onChange={(e) =>
                        updateExtremeParticipant(team.team_id, {
                          ...extremeParticipants[team.team_id],
                          player_id: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="">— Seleccionar jugador —</option>
                      {getTeamPlayers(team.team_id).map((p) => (
                        <option key={p.player_id} value={p.player_id}>
                          {p.nick || p.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={extremeParticipants[team.team_id]?.start_date || ""}
                      onChange={(e) =>
                        updateExtremeParticipant(team.team_id, {
                          ...extremeParticipants[team.team_id],
                          start_date: e.target.value,
                        })
                      }
                      placeholder="Fecha inicio"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />

                    <input
                      type="date"
                      value={extremeParticipants[team.team_id]?.end_date || ""}
                      onChange={(e) =>
                        updateExtremeParticipant(team.team_id, {
                          ...extremeParticipants[team.team_id],
                          end_date: e.target.value,
                        })
                      }
                      placeholder="Fecha fin"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Risky */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ⚠️ Risky (hasta 2 jugadores)
                    </label>
                    <button
                      onClick={() =>
                        addRiskyParticipant(team.team_id, {
                          player_id: "",
                          start_date: "",
                          end_date: "",
                        })
                      }
                      disabled={(riskyParticipants[team.team_id] || []).length >= 2}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Agregar Risky
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(riskyParticipants[team.team_id] || []).map((risky, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                        <select
                          value={risky.player_id || ""}
                          onChange={(e) => {
                            const updated = [...riskyParticipants[team.team_id]];
                            updated[idx].player_id = e.target.value;
                            setRiskyParticipants({
                              ...riskyParticipants,
                              [team.team_id]: updated,
                            });
                          }}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">— Seleccionar —</option>
                          {getTeamPlayers(team.team_id).map((p) => (
                            <option key={p.player_id} value={p.player_id}>
                              {p.nick || p.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={risky.start_date || ""}
                          onChange={(e) => {
                            const updated = [...riskyParticipants[team.team_id]];
                            updated[idx].start_date = e.target.value;
                            setRiskyParticipants({
                              ...riskyParticipants,
                              [team.team_id]: updated,
                            });
                          }}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />

                        <input
                          type="date"
                          value={risky.end_date || ""}
                          onChange={(e) => {
                            const updated = [...riskyParticipants[team.team_id]];
                            updated[idx].end_date = e.target.value;
                            setRiskyParticipants({
                              ...riskyParticipants,
                              [team.team_id]: updated,
                            });
                          }}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />

                        <button
                          onClick={() => removeRiskyParticipant(team.team_id, idx)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}

                    {(!riskyParticipants[team.team_id] || riskyParticipants[team.team_id].length === 0) && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No hay participantes Risky agregados
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
