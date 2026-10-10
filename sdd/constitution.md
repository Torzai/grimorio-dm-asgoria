# Constitución — Grimorio del DM (Asgoria)

> Documento rector del proyecto. Toda spec, plan y tarea debe respetarlo.
> Si una tarea choca con este documento, se para y se consulta al humano.

## 1. Propósito

Herramienta de consulta local para DMs del servidor de NWN **Asgoria**: lore, NPCs, zonas, varitas personalizadas, comandos y herramientas, con búsqueda instantánea. Se usa **en segunda pantalla durante la partida**, así que la velocidad para encontrar algo es lo primero.

Debe poder heredarse: el día que los DMs actuales se vayan, un DM nuevo tiene que poder clonarlo, arrancarlo y añadir fichas sin conocer React.

## 2. Principios no negociables

### P1 — Contenido y app separados
- El contenido vive en `content/**/*.md` (Markdown con frontmatter YAML).
- La app es un **visor**. Añadir o editar una ficha **nunca** requiere tocar código.
- Ningún texto de lore va hardcodeado en componentes.

### P2 — Local-first, sin backend
- Sin servidor propio ni base de datos. Sin `fetch` a servicios externos en runtime.
- El contenido se incluye en el bundle con `import.meta.glob`.
- Funciona sin conexión a internet (salvo fuentes web, que tienen fallback del sistema).

### P3 — Contenido validado
- Cada tipo de ficha tiene un esquema **Zod** en `src/content/schemas.ts`.
- `npm run validate` valida todo `content/` y falla con **ruta del fichero + campo + motivo**.
- `validate` se ejecuta en `prebuild`, en el hook `pre-commit` y en CI.
- En `dev`, una ficha inválida **no rompe la app**: se excluye y se muestra en un aviso visible.

### P4 — Consulta rápida primero
- `Ctrl+K` / `Cmd+K` abre la búsqueda desde cualquier pantalla.
- Toda la navegación principal es usable solo con teclado.
- La búsqueda responde en < 50 ms con 2.000 fichas en un portátil normal.
- La búsqueda tolera erratas y prefijos y busca en título, alias, tags y cuerpo, por ese orden de peso.

### P5 — Estética Asgoria, accesible
- Estilo de la web oficial: fondo casi negro, dorado envejecido, títulos en Cinzel, texto en Crimson Pro y código en IBM Plex Mono.
- Todos los colores, tipografías y espaciados salen de tokens CSS en `src/styles/tokens.css`. Prohibidos los hex sueltos en componentes.
- Contraste mínimo AA (4.5:1 en texto normal), foco visible, `<button>` y `<a>` reales, `aria-label` en botones de solo icono.
- Sin librerías de componentes pesadas (MUI, Ant, Chakra…).
- La referencia visual está en /sdd/design/maqueta-ficha.html y /sdd/design/maqueta-palette.html. Toda tarea de UI la consulta antes de maquetar.

### P6 — Simplicidad y dependencias cerradas
- Stack fijado en `plan.md`. Añadir una dependencia de runtime requiere justificarla en la tarea y que el humano la apruebe.
- Se prefiere código propio pequeño y legible a una librería para algo trivial.

### P7 — Calidad de código
- TypeScript `strict`. Prohibido `any`; si hace falta, `unknown` y narrowing.
- Código, nombres y comentarios en **inglés**. UI y contenido en **español**.
- Componentes funcionales y hooks. La lógica pura (parseo, índice, enlaces) va fuera de los componentes.
- No se escriben tests automáticos (ni Vitest ni Playwright). Un test existente que rompa el build o el lint se borra.
- ESLint + Prettier sin errores ni warnings para cerrar una tarea.

### P8 — Verificación
- Una tarea se cierra con `validate`, `lint` y `build` en verde y una comprobación manual en el navegador.
- La comprobación manual puede hacerse a mano o navegando con Playwright, sin escribir specs.

### P9 — Flujo SDD
- Constitución → spec → plan → tasks. **Una tarea por sesión.**
- El agente **nunca hace commit ni push**. Deja los cambios listos y propone el mensaje de commit. El humano revisa el diff y commitea.
- El agente no amplía el alcance de la tarea. Si detecta algo fuera de alcance, lo anota como propuesta en la respuesta.

### P10 — Privacidad y propiedad del contenido
- Repo **privado**.
- Nunca se guardan credenciales en el repo. `auth.json`, `.env*` y `scraper/raw/` van en `.gitignore`.
- El lore pertenece a Asgoria. No se publica fuera del círculo de DMs sin permiso de los admins.
- No se almacenan mensajes privados ni datos personales de otros jugadores. Solo contenido de referencia (lore, reglas, sistemas, NPCs).
- De los PJ, la cuenta de NWN sí se guarda; email y Discord nunca.

### P11 — Heredabilidad
- `README.md` para cualquier DM: requisitos, cómo arrancar, cómo actualizar y cómo crear una ficha.
- `content/README.md` documenta cada tipo de ficha con su plantilla.
- `content/_templates/` contiene una plantilla copiable por tipo.

## 3. Definición de "hecho" (para cualquier tarea)

1. Cumple todos los criterios de aceptación de la tarea en `tasks.md`.
2. Una tarea se cierra con `validate`, `lint` y `build` en verde y una comprobación manual en el navegador.
3. No se han escrito tests.
4. No hay cambios fuera de los ficheros que la tarea justifica.
5. La respuesta final incluye: resumen, ficheros tocados (ruta completa desde la raíz), cómo verificarlo y mensaje de commit propuesto (Conventional Commits).
