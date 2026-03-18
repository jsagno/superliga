# Feature: Tablas de Posiciones (Zonas / Liga A / Liga B)

**Producto:** liga-jugador  
**Stitch Screen ID:** `bde972608291443190fe80ccffc82c8c`  
**Archivo objetivo:** `packages/liga-jugador/src/pages/TablaPosiciones.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Vista de clasificación individual de todos los jugadores, organizada por temporada, liga (A o B) y zona. El jugador autenticado aparece resaltado con una etiqueta "(Tú)" y la lista hace auto-scroll a su posición al cargar.

---

## Diseño Visual

![Tablas de Posiciones](https://lh3.googleusercontent.com/aida/AOfcidW8xsW4L7idXQ9w30ZwQVit6JoSut30oPEj34h0H5RmPrPOvoNiLK_j4VenczqIcvFTmk3qV3pxirpk9S4crEL4Nl6rUF0Ev0VJS289iqqZ_M7a7KVHKD7i_LRT4VrY8P1rUI4p9GYi0MzeBYgwe0AnhR-dD-zc6ZpBYyBXuCqAwp8Z7hrWRtCm7EzxU6be8NwWrGh_fFlaeUShTsnJloYu3HT-ffFj1sBLpuBruglNbc-_F9OqAqHARrQ)

---

## Requerimientos Funcionales

### RF-TABLA-01: Selector de temporada
- Dropdown en el header para seleccionar la temporada a visualizar
- Por defecto: la temporada activa
- Formato: "Temporada X"

### RF-TABLA-02: Tabs de vista
Tres tabs en la parte superior:
1. **Zonas** — muestra todos los jugadores en la zona del jugador autenticado (por defecto)
2. **Liga A** — muestra el ranking consolidado de Liga A
3. **Liga B** — muestra el ranking consolidado de Liga B

### RF-TABLA-03: Filtro de zona (chips)
- Solo aplicable en el tab "Zonas"
- Chips: "Todas" | "Zona 1" | "Zona 2" | "Zona 3" | "Zona 4"
- Por defecto: la zona del jugador autenticado está seleccionada

### RF-TABLA-04: Fila de jugador (StandingsRow)
Cada fila muestra:
- Posición (#N, número grande)
- Avatar del jugador (imagen o inicial del nombre)
- Nombre del jugador
- Puntos totales
- Indicador de tendencia:
  - `arrow_drop_up` (verde) = subió posiciones vs. período anterior
  - `remove` (gris) = sin cambio
  - `arrow_drop_down` (rojo) = bajó posiciones
- Win-Loss record (ej. "18W - 5L") — mostrado como subtexto
- Nombre del clan — mostrado como subtexto

### RF-TABLA-05: Resaltado del jugador autenticado
- La fila del jugador autenticado tiene fondo diferenciado (ej. azul oscuro o borde de color)
- Etiqueta "(Tú)" o icono `progress_activity` junto al nombre
- Al cargar la página, hacer auto-scroll a la fila del jugador (#12, etc.)

### RF-TABLA-06: Estado de carga y vacío
- Skeletons mientras carga la tabla
- Si no hay jugadores en la zona seleccionada: "No hay jugadores en esta zona"

---

## Componentes UI

```
TablaPosiciones
├── Header "Tablas de Posiciones" + [FilterIcon]
├── SeasonSelector (dropdown)
├── Tabs [Zonas | Liga A | Liga B]
├── ZoneChips [Todas | Zona 1 | Zona 2 | Zona 3 | Zona 4]  (solo en tab Zonas)
├── PlayerList
│   └── StandingsRow × N
│       ├── Position (#N)
│       ├── Avatar
│       ├── Name + "(Tú)" si es el jugador actual
│       ├── Points
│       ├── TrendIndicator (↑↓=)
│       ├── W-L record
│       └── Clan name
└── BottomNav
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Cargar tabla temporada activa | Muestra clasificación correcta por zona del jugador |
| 2 | Cambiar a tab "Liga A" | Muestra clasificación Liga A consolidada |
| 3 | Filtrar por "Zona 2" | Solo muestra jugadores de la Zona 2 |
| 4 | Jugador autenticado en posición #12 | Fila #12 resaltada, auto-scroll a ella |
| 5 | Cambiar temporada (histórica) | Tabla se actualiza con datos de esa temporada |
| 6 | Menos de 4 zonas configuradas | Solo muestra chips para zonas existentes |
