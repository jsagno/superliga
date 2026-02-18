# Validación de Mazos Extreme/Risky en Battles History

## Funcionalidad Implementada

Se agregó validación automática de mazos para jugadores en modo Extreme o Risky durante duelos de guerra.

### Características

#### Detección Automática
- El sistema detecta si un jugador estaba en modo Extreme o Risky en la fecha de la batalla
- Consulta `season_extreme_participant` con las fechas `start_date` y `end_date`
- Obtiene las cartas permitidas desde `season_extreme_config`

#### Reglas de Validación

**EXTREME (🔥 + is_risky = false)**
- **2 rondas (2-0 o 0-2)**: Los 2 primeros mazos deben usar 100% las cartas permitidas
- **3 rondas (2-1 o 1-2)**: Los 3 mazos deben usar 100% las cartas permitidas
- Los mazos individuales de guerra (después de 2-0) pueden usar cualquier carta

**RISKY (🔥 + is_risky = true)**
- **2 rondas (2-0 o 0-2)**: Al menos 1 mazo debe usar las cartas permitidas
- **3 rondas (2-1 o 1-2)**: Al menos 2 mazos deben usar las cartas permitidas

#### Interfaz de Usuario

En la lista de batallas, los duelos de guerra con jugadores en modo Extreme/Risky muestran:

1. **Ícono de fuego 🔥**: Indica que el jugador estaba en modo Extreme/Risky
2. **Validación**:
   - **✓ (azul)**: Mazos cumplen con las reglas
   - **✗ (rojo)**: Mazos NO cumplen con las reglas
3. **Tooltip**: Al hacer hover, muestra detalles:
   - "Extreme: 2/2 mazos válidos (requiere 2)"
   - "Risky: 1/2 mazos válidos (requiere 1)"

### Funciones Creadas

#### `fetchPlayerExtremeConfig(playerId, battleDate)`
```javascript
// Retorna la configuración Extreme/Risky para un jugador en una fecha específica
{
  isRisky: boolean,
  allowedCardIds: [card_id_1, card_id_2, ...]
}
```

#### `validateDeck(deckCards, allowedCardIds)`
```javascript
// Valida si un mazo usa solo cartas permitidas
// Retorna true si todas las cartas del mazo están en allowedCardIds
```

#### `validateExtremeDuel(perRound, isRisky, allowedCardIds)`
```javascript
// Valida un duelo completo según las reglas Extreme/Risky
// Retorna { valid: boolean, message: string }
```

### Ejemplo de Uso

**Escenario**: Jugador con Extreme usando cartas [1, 2, 3, 4, 5, 6, 7, 8]

**Batalla 2-0**:
- Mazo 1: [1, 2, 3, 4, 5, 6, 7, 8] → ✓ Válido
- Mazo 2: [1, 2, 3, 4, 5, 6, 7, 9] → ✗ Inválido (carta 9 no permitida)
- Resultado: ✗ (requiere 2 mazos válidos, tiene 1)

**Batalla 2-1**:
- Mazo 1: [1, 2, 3, 4, 5, 6, 7, 8] → ✓ Válido
- Mazo 2: [1, 2, 3, 4, 5, 6, 7, 8] → ✓ Válido
- Mazo 3: [1, 2, 3, 4, 5, 6, 7, 8] → ✓ Válido
- Resultado: ✓ (requiere 3 mazos válidos, tiene 3)

### Consideraciones Técnicas

1. **Performance**: Las configuraciones se cargan solo para duelos de guerra del jugador seleccionado
2. **Fechas**: Se compara con `start_date` y `end_date` del participante
3. **Solo Duelos**: La validación solo aplica a batallas con `round_count > 1` y `api_battle_type === 'war'`
4. **Jugador TEAM**: La validación se hace solo para el jugador del TEAM (el seleccionado en el filtro)

### Base de Datos

**Tablas utilizadas**:
- `season_extreme_participant`: Períodos de participación con `start_date`, `end_date`, `is_risky`
- `season_extreme_config`: Cartas permitidas en `card_ids` (JSON array)
- `battle`, `battle_round`, `battle_round_player`: Datos de batallas y mazos

### Limitaciones Actuales

1. Solo valida para el jugador seleccionado en el filtro (TEAM side)
2. No valida jugadores del lado OPPONENT
3. Asume que `deck_cards` es un array de objetos con propiedad `id`
4. La validación es visual solamente, no afecta estadísticas

### Mejoras Futuras

- Validar también jugadores del lado OPPONENT
- Mostrar detalles de qué cartas específicas son inválidas
- Agregar estadísticas de cumplimiento (% de batallas válidas)
- Alertas automáticas para jugadores con validaciones fallidas
- Filtro para mostrar solo batallas con validación fallida
