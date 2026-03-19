## Context

Liga-admin ya utiliza Supabase para autenticación y un AuthContext propio para sesión y rol, además de rutas protegidas bajo /admin. Sin embargo, el punto de entrada en la raíz no está definido como entrypoint canónico de autenticación para admin, y el flujo de identidad no está alineado al patrón de liga-jugador, que centraliza resolución de identidad, manejo de estados de sesión y consistencia de rol.

Este cambio afecta navegación inicial, resolución de sesión y autorización por rol en el frontend de liga-admin. El objetivo es reducir estados ambiguos, unificar criterios de seguridad entre aplicaciones y asegurar una UX consistente.

Stakeholders:
- Administradores (ADMIN, SUPER_ADMIN, SUPER_USER)
- Operación/soporte de torneos
- Equipo de desarrollo frontend

Restricciones:
- Mantener compatibilidad con rutas existentes de /admin
- No introducir cambios de base de datos ni migraciones
- Mantener política de roles actual para acceso administrativo

## Goals / Non-Goals

**Goals:**
- Garantizar que visitar / en liga-admin redirija de forma inmediata a /admin/login.
- Alinear el flujo de autenticación de liga-admin con el enfoque de liga-jugador para sesión e identidad.
- Estandarizar la validación de roles administrativos en un único punto de decisión para acceso a rutas protegidas.
- Mantener comportamiento actual esperado para usuarios con rol permitido.

**Non-Goals:**
- Cambiar el proveedor de autenticación (se mantiene Supabase).
- Rediseñar visualmente LoginAdmin.
- Implementar SSO entre aplicaciones o compartir tokens entre dominios distintos.
- Modificar permisos de base de datos o modelo de roles.

## Decisions

1. Definir / como redirección canónica hacia /admin/login
- Decisión: agregar una ruta explícita para / que navegue a /admin/login con replace.
- Rationale: evita entrada ambigua y unifica onboarding al flujo de login.
- Alternativas consideradas:
  - Redirigir / a /admin: descartada porque depende del estado de sesión y produce saltos adicionales para no autenticados.
  - Mantener / sin definición: descartada por inconsistencia UX y mayor fricción.

2. Alinear AuthContext de liga-admin con patrón de resolución de identidad de liga-jugador
- Decisión: extraer y unificar lógica de sesión/resolución en un servicio de auth (getSession, onAuthStateChange, resolveIdentity) equivalente al patrón de liga-jugador, adaptado a reglas admin.
- Rationale: reduce divergencia entre apps y facilita mantenimiento de seguridad.
- Alternativas consideradas:
  - Mantener lógica inline en AuthContext: descartada por acoplamiento y duplicación.
  - Copiar implementación completa sin adaptación: descartada para evitar dependencias de conceptos player-only.

3. Preservar y centralizar gate de roles ADMIN, SUPER_ADMIN, SUPER_USER
- Decisión: conservar lista de roles permitidos y aplicar validación en un único camino de autorización consumido por ProtectedRoute y login.
- Rationale: consistencia en decisiones de acceso y menor riesgo de drift.
- Alternativas consideradas:
  - Validar rol solo en LoginAdmin: descartada porque no cubre refrescos o cambios de sesión.
  - Validar rol solo en ProtectedRoute: descartada porque el login requiere feedback temprano y limpieza de sesión cuando rol no permitido.

4. Tratar sesión autenticada sin rol permitido como estado denegado y cerrar sesión
- Decisión: cuando una sesión existe pero no cumple rol permitido, invalidar sesión localmente mediante signOut y devolver mensaje de acceso denegado.
- Rationale: minimiza ventanas de acceso inconsistente y deja estado explícito al usuario.
- Alternativas consideradas:
  - Mantener sesión iniciada y solo ocultar rutas: descartada por riesgo de comportamiento inesperado.

## Risks / Trade-offs

- [Riesgo] Diferencias finas entre flujo player y flujo admin generen regresiones en login existente.
  - Mitigación: mantener contrato de UI de LoginAdmin y cubrir con pruebas de redirección, rol permitido y rol denegado.

- [Riesgo] Redirección de / afecte deep links o bookmarks heredados.
  - Mitigación: preservar rutas actuales bajo /admin y usar replace para no contaminar historial.

- [Riesgo] Doble validación de rol (login y ruta protegida) incremente complejidad.
  - Mitigación: encapsular decisión de autorización en utilidad única reutilizable.

- [Trade-off] Mayor alineación entre apps implica refactor moderado en liga-admin ahora para reducir costo futuro.
  - Mitigación: cambios incrementales, sin introducir nuevas dependencias.

## Migration Plan

1. Implementar ruta raíz / con redirección a /admin/login.
2. Introducir/ajustar servicio de auth en liga-admin con operaciones equivalentes a liga-jugador (sesión, cambios de auth, resolución de identidad/rol).
3. Refactorizar AuthContext para consumir el servicio unificado y exponer estados coherentes.
4. Ajustar LoginAdmin y ProtectedRoute para usar la misma decisión de autorización.
5. Agregar/actualizar pruebas de:
   - redirección / -> /admin/login
   - bloqueo de rutas admin para no autenticados
   - acceso para ADMIN/SUPER_ADMIN/SUPER_USER
   - denegación + signOut para roles no permitidos
6. Ejecutar lint y suites relevantes.
7. Rollback (si aplica): revertir commit del cambio y restaurar comportamiento previo de rutas/auth.

## Open Questions

- ¿La redirección de / debe activarse en todos los entornos o solo en despliegues donde liga-admin vive en dominio dedicado?
- ¿Debemos mostrar un mensaje específico para rol no autorizado en LoginAdmin o un texto genérico de acceso denegado?
- ¿Conviene factorizar utilidades auth compartidas en shared/ para evitar duplicación futura entre liga-admin y liga-jugador?