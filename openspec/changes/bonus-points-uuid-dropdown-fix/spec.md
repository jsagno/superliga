# Especificación: Bonus Points UUID y Dropdown

## 1. Problemas
- Error de validación de UUID al guardar bonus-points con id no válido.
- Dropdown de jugador con estilos inconsistentes.

## 2. Criterios de aceptación
- No se puede guardar un bonus-point con id no UUID.
- El frontend genera siempre UUID v4.
- El error de validación es claro para el usuario.
- El dropdown de jugador tiene los mismos estilos que el resto de la app.

## 3. Solución técnica
- Generar UUID v4 en frontend (ej: `import { v4 as uuidv4 } from 'uuid';`).
- Validar y migrar ids legacy en backend.
- Mejorar mensaje de error.
- Reutilizar componente estándar de dropdown y ajustar estilos.

## 4. Ejemplos
- Input inválido: id = "manual-1774134955451"
- Input válido: id = "a3f1c2e4-5b6d-4c7e-8f9a-1b2c3d4e5f6a"
- Antes: fondo blanco puro, sin bordes
- Después: igual a otros dropdowns (fondo, bordes, padding, etc.)

## 5. Tareas
1. Actualizar frontend para UUID v4.
2. Validar/migrar ids legacy.
3. Mejorar mensaje de error.
4. Reemplazar dropdown y ajustar estilos.
5. QA visual y funcional.