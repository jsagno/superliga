# Feature: Tabla de Posiciones de Equipos

**Producto:** liga-jugador  
**Stitch Screen ID:** `d4189a3869e9487cb64c11327c7d7f48`  
**Archivo objetivo:** `packages/liga-jugador/src/pages/TablaEquipos.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Vista de clasificación de equipos dentro de cada zona. Presenta un podio visual de los tres mejores equipos y una tabla general con todos los equipos ordenados por puntos. El equipo del jugador autenticado se resalta.

---

## Diseño Visual

![Tabla de Equipos](https://lh3.googleusercontent.com/aida/AOfcidVuCPcCpR8RHByMx3leJ0gLOPHK1kNMwMnulM0xtunChufm7f61aAV4YSBdkfUerrcIx5eMHG3TPCMxwdt7qyBkcux_06eGi4F3CWdqiy74bzRBPmT0csr41hUhu0-D_gCiXYrQG5dzVSy6C4Zc1_mY6FQFqm11PC4AY-OmExgRtW7-KwRK4yfyEoVgPj8UGZviF9H8tbdLeyGIJlR_CnKttl-OPgsQYM0czV4APulmSQTE7pNQOaHjMg)

---

## Requerimientos Funcionales

### RF-EQUIPOS-01: Selector de zona
- Tabs horizontales al top: "Zona 1" | "Zona 2" | "Zona 3" | "Zona 4"
- Por defecto: la zona del jugador autenticado está seleccionada

### RF-EQUIPOS-02: Podio de los 3 primeros ("Líderes de Temporada")
Sección visual destacada al tope con:
- **#2** (izquierda, plataforma más baja): nombre equipo + puntos
- **#1** (centro, plataforma más alta): nombre equipo + puntos + ícono de corona 👑
- **#3** (derecha, plataforma baja): nombre equipo + puntos
- Label: "Temporada N" en el podio
- Indicadores de tendencia junto a cada posición (↑ / = / ↓)

### RF-EQUIPOS-03: Tabla de clasificación general
- Columnas: **#** | **Equipo** | **Pts**
- Subtexto por equipo: W-L record (ej. "25W - 12L")
- Indicador de tendencia por equipo
- El equipo del jugador autenticado aparece con fondo diferenciado

### RF-EQUIPOS-04: Indicadores de tendencia
- `trending_up` / verde = subió al menos 1 posición
- `trending_flat` / gris = sin cambio
- `trending_down` / rojo = bajó al menos 1 posición
- Comparar posición actual vs. posición en el día/semana anterior

### RF-EQUIPOS-05: Resaltado del equipo propio
- El equipo al que pertenece el jugador autenticado aparece con fondo azul o borde destacado en la tabla general

---

## Componentes UI

```
TablaEquipos
├── Header "Tabla de Posiciones"
├── ZoneTabs [Zona 1 | Zona 2 | Zona 3 | Zona 4]
├── Podium "Líderes de Temporada"
│   ├── TeamPodiumCard(#2, izquierda)
│   ├── TeamPodiumCard(#1, centro, corona)
│   └── TeamPodiumCard(#3, derecha)
├── "Clasificación General"
│   └── TeamStandingsRow × N
│       ├── Position
│       ├── TeamName + W-L record
│       ├── Points
│       └── TrendIndicator
└── BottomNav
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Cargar zona activa del jugador | Podio y tabla muestran equipos de esa zona |
| 2 | Cambiar zona en el tab | Podio y tabla se actualizan con la zona seleccionada |
| 3 | Menos de 3 equipos en zona | Podio muestra solo los disponibles (sin crash) |
| 4 | Equipo del jugador en posición #4 | Fila #4 resaltada en tabla, no aparece en podio |
| 5 | Equipo del jugador en posición #1 | Card del podio #1 resaltada + fila en tabla |
| 6 | Equipos empatados en puntos | Ordenar por W-L record (más victorias primero) |
