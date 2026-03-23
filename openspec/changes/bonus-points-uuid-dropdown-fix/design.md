# Diseño: Bonus Points UUID y Dropdown

## Validación y generación de UUID
- El frontend debe generar siempre un UUID v4 para cada bonus-point nuevo (usar librería estándar como `uuid`).
- El backend debe validar que el id recibido sea un UUID válido.
- Si existen registros legacy con ids no UUID, migrarlos a UUID válidos.
- Mejorar el mensaje de error para el usuario final.

## Dropdown de jugador
- Reutilizar el componente estándar de dropdown de la app.
- Asegurar fondo, bordes, padding, tipografía y comportamiento igual a otros dropdowns.
- QA visual para verificar consistencia.