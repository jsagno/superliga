## Context

`scheduled_match` se guarda en UTC y Cup Matches renderiza fechas en formato local genérico. Para `CW_DAILY` en etapa `SW_Duel_1v1`, operación requiere vista normalizada en UTC-3 para evitar desfasajes de día/hora en administración. En paralelo, LIGA-JUGADOR necesita advertir al jugador cuando no tiene duelo diario jugado para el día activo, aun sin crear filas nuevas en `scheduled_match`.

## Goals / Non-Goals

**Goals:**
- Aplicar conversión UTC-3 solo al render de `CW_DAILY` + `SW_Duel_1v1` en Cup Matches.
- Mantener render actual para otros tipos/etapas.
- Generar pendiente visual virtual en LIGA-JUGADOR para duelo diario no jugado del día activo.
- Bloquear acción de vinculación en pendientes virtuales.
- Evitar escrituras en base de datos para este pendiente virtual.

**Non-Goals:**
- No cambiar timestamps persistidos en `scheduled_match`.
- No alterar lógica de autolink CRON.
- No introducir migraciones de base de datos.
- No cambiar reglas de scoring.

## Decisions

1. Conversión condicional en UI de liga-admin:
- Se crea helper de formateo con offset fijo UTC-3 para `formatDateOnly` y `formatDeadline`.
- La conversión solo se activa cuando `row.type === "CW_DAILY" && row.stage === "SW_Duel_1v1"`.
- El cálculo relativo de vencimiento ("vence en") mantiene el timestamp original para no distorsionar duración.

2. Pendiente virtual en liga-jugador sin persistencia:
- Se calcula un `todayKey` operativo (UTC-3) y se verifica si hay `CW_DAILY` del día activo para el jugador.
- Si no existe, y hoy está dentro de la ventana de duelos (`duel_start_date` a `duel_end_date`), se agrega objeto virtual en memoria.
- El objeto virtual incluye bandera `isVirtual` y `linkDisabled` para controlar UI.

3. Reutilización en dashboard y batallas pendientes:
- Se aplica la misma regla de pendiente virtual en `fetchPendingMatchesSummary` (dashboard) y `fetchPendingMatches`/`fetchPendingMatchesCount` (pantalla Batallas Pendientes) para consistencia.

4. Estado no vinculable explícito:
- `PendingBattleCard` deshabilita botón `Vincular` cuando `match.linkDisabled === true`.
- Se muestra etiqueta contextual para indicar que es un pendiente informativo.

## Risks / Trade-offs

- [Riesgo] Offset fijo UTC-3 no contempla DST futuro fuera de AR. → Mitigación: requisito actual pide UTC-3 fijo para operación; documentar explícitamente.
- [Riesgo] Falsos positivos del pendiente virtual si hay latencia de sincronización CRON. → Mitigación: solo crear virtual si no existe ningún `CW_DAILY` del día para el jugador en la temporada activa.
- [Riesgo] Duplicado visual con pendientes reales. → Mitigación: deduplicar por existencia diaria antes de insertar virtual.

## Migration Plan

- Deploy sin migraciones.
- Validar en entorno QA con casos:
  - `CW_DAILY/SW_Duel_1v1` muestra fechas en UTC-3.
  - Otros tipos mantienen visual actual.
  - Jugador sin duelo diario jugado ve pendiente virtual no vinculable.
- Rollback: revertir cambios en servicios/frontend de ambos paquetes.

## Open Questions

- ¿El pendiente virtual debe mostrarse también para días pasados no jugados o solo para el día operativo actual? En este cambio se define solo día vigente.