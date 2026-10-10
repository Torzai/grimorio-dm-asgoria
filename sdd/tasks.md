# Tasks — Grimorio del DM (Asgoria)

> Una tarea por sesión. Cada tarea cumple la "definición de hecho" de `sdd/constitution.md` §3.
> 🎭 = requiere verificación con Playwright.

| # | Tarea | Depende de | Playwright |
|---|---|---|---|
| T01 | Scaffold y tooling | — | No |
| T02 | Modelo de contenido, loader y `validate` | T01 | No |
| T03 | Enlaces internos e índice de búsqueda | T02 | No |
| T04 | Tokens de diseño y layout base | T03 | 🎭 Sí |
| T05 | Lista por tipo y filtros | T04 | 🎭 Sí |
| T06 | Vista de ficha genérica | T05 | 🎭 Sí |
| T07 | Cards por tipo | T06 | 🎭 Sí |
| T08 | Command palette Ctrl+K | T06 | 🎭 Sí |
| T09 | Fijados y recientes + home | T08 | 🎭 Sí |
| T10 | Imágenes y visor de mapas | T06 | 🎭 Sí |
| T11 | README, plantillas y pre-commit | T02 | No |
| T12 | CI en GitHub Actions | T11 | No |
| T13 | Importador: login y crawl del foro | T12 | No |
| T14 | Importador: conversión a borradores | T13 | No |

---

## T01 · Scaffold y tooling
**Objetivo:** repo arrancable con todo el tooling y la estructura de carpetas vacía.
- Vite + React + TS strict; alias `@/` → `src/`.
- ESLint (flat config, reglas React y hooks), Prettier, Vitest + Testing Library, Playwright instalado con un spec de humo.
- Scripts: `dev`, `build`, `preview`, `lint`, `format`, `test`, `test:e2e`, `validate` (de momento un placeholder que sale con 0).
- Estructura de `plan.md` §2 creada con `.gitkeep` donde haga falta.
- `.gitignore` con `node_modules`, `dist`, `scraper/auth.json`, `scraper/raw/`, `.env*`, informes de Playwright.
- `.nvmrc` con la LTS de Node.
- `src/App.tsx` mínimo con un "Grimorio del DM" en pantalla.

**Aceptación:** `npm run lint`, `npm run test` (1 test trivial) y `npm run build` pasan; `npm run dev` muestra la pantalla mínima.

## T02 · Modelo de contenido, loader y `validate`
**Objetivo:** el contenido se carga, se valida y los errores son legibles.
- `src/content/schemas.ts`: esquemas Zod por tipo (spec §3) y unión discriminada por `type`. Mensajes en español.
- `src/content/frontmatter.ts`: separa el frontmatter del cuerpo y parsea YAML; error claro si falta o está mal.
- `src/content/normalize.ts`: `normalize()` (minúsculas, sin tildes) y `slugify()`.
- `src/content/loader.ts`: función pura `loadEntries(files: Record<string, string>) → { entries, issues }`; ignora `_*/` y `assets/`; comprueba que la carpeta coincide con `type` y detecta slugs duplicados.
- `src/content/load-from-fs.ts` y `scripts/validate-content.ts`: imprimen los issues agrupados por fichero; salen con 1 si hay errores (los warnings no bloquean).
- Fichas de ejemplo ficticias: 3 por tipo, con `tags: [ejemplo]`.
- `prebuild` ejecuta `validate`.

**Aceptación:** tests de Vitest que cubren frontmatter válido e inválido, campo obligatorio ausente, tipo desconocido, carpeta ≠ tipo, slug duplicado y exclusión de `_templates`; `npm run validate` pasa con los ejemplos y falla (con mensaje útil) si se rompe uno.

## T03 · Enlaces internos e índice de búsqueda
**Objetivo:** grafo de enlaces y búsqueda funcionando como lógica pura.
- `src/content/links.ts`: resolver `[[x]]` y `[[x|texto]]` por slug, título o alias (normalizado); backlinks por ficha; detectar enlaces rotos y referencias rotas en `zona` y `relacionados` → warnings.
- `src/content/remark-wikilinks.ts`: convierte wikilinks en nodos de enlace con `data-broken` cuando no resuelven.
- `src/content/search-index.ts`: `buildIndex(entries)` y `search(index, q, { type? })` según plan §5.
- `validate` incluye los warnings de enlaces.
- Benchmark en un test: 2.000 fichas sintéticas, búsqueda < 50 ms (umbral holgado en CI).

**Aceptación:** tests de resolución (tildes, mayúsculas, alias), backlinks, enlaces rotos, búsqueda fuzzy ("sigrund" encuentra "Sigründ"), por prefijo y filtrada por tipo, y peso de título > cuerpo.

## T04 · Tokens de diseño y layout base 🎭
**Objetivo:** el esqueleto visual de la maqueta.
- `src/styles/tokens.css` con los colores, tipografías (Cinzel, Crimson Pro, IBM Plex Mono), espaciados y radios de la maqueta. Fallbacks serif y mono del sistema.
- `src/app/AppShell.tsx`: header (marca + campo de búsqueda que de momento lleva a `/buscar`), sidebar con tipos y contadores, `<Outlet/>`.
- `src/app/router.tsx` con las rutas de plan §6 (páginas placeholder).
- `ContentContext` con entries, índice e issues.
- `features/content-issues`: aviso en dev si hay errores.
- Página 404.

**Aceptación (Playwright):** la home carga; el sidebar muestra todos los tipos con contadores correctos; navegar a un tipo cambia la URL; el foco es visible al tabular; a 390 px el layout no desborda horizontalmente.

## T05 · Lista por tipo y filtros 🎭
- `/:type` lista las fichas ordenadas por título con `resumen` y zona.
- Chips de filtro por zona, facción (si aplica) y tag, combinables y sincronizados con la URL.
- Estado vacío con enlace para limpiar filtros.

**Aceptación (Playwright):** filtrar reduce la lista; recargar mantiene los filtros; limpiar los quita.

## T06 · Vista de ficha genérica 🎭
- `/:type/:slug`: cabecera (tipo, título, alias), tags, cuerpo con `react-markdown` + `remark-gfm` + wikilinks.
- Panel lateral: relacionados, "mencionado en" (backlinks) y sesiones que la mencionan.
- Enlaces rotos con estilo distinto y no navegables.
- Slug inexistente → 404.

**Aceptación (Playwright):** un `[[enlace]]` navega a la ficha correcta; los backlinks aparecen en la destino; un enlace roto no navega.

## T07 · Cards por tipo 🎭
- Bloque de datos clave específico por tipo (spec HU-03): NPC, varita, comando (con botón Copiar sintaxis), herramienta, zona (miniatura del mapa si la hay), lore (categoría), sesión (fecha, narradores).
- Registro `type → componente`; un tipo sin card usa el bloque genérico.

**Aceptación (Playwright):** cada tipo de ejemplo muestra sus campos; Copiar pone la sintaxis en el portapapeles.

## T08 · Command palette Ctrl+K 🎭
- `Ctrl+K` / `Cmd+K` abre desde cualquier ruta; también el campo del header. `Esc` cierra y devuelve el foco.
- Input con resultados agrupados por tipo, chips para filtrar por tipo, vista previa a la derecha.
- `↑/↓`, `Enter` abre, `Ctrl+Enter` fija (por ahora solo un stub hasta T09).
- Accesible: `role="dialog"`, `aria-modal`, foco atrapado, `aria-activedescendant` en la lista.
- `/buscar?q=` muestra los resultados completos.

**Aceptación (Playwright):** abrir con atajo, escribir con una errata, navegar con flechas y abrir con Enter; Esc cierra y devuelve el foco.

## T09 · Fijados y recientes + home 🎭
- Hook `useLocalStorage` tolerante a fallos.
- Fijar/desfijar desde la ficha y desde la palette; fijados en el sidebar.
- Recientes (máx. 10, sin duplicados) al abrir una ficha.
- Home: fijados, recientes, accesos por tipo y últimas 3 sesiones.

**Aceptación (Playwright):** fijar persiste tras recargar; los recientes se ordenan del más nuevo al más antiguo; con `localStorage` bloqueado la app sigue funcionando.

## T10 · Imágenes y visor de mapas 🎭
- Resolver imágenes de `content/assets/` en el frontmatter (`mapa`) y en el cuerpo (rutas relativas).
- `features/image-viewer`: pantalla completa, zoom con rueda o botones, arrastre, `Esc` para cerrar. Sin librería salvo justificación.
- Imagen que no existe → issue en `validate` y placeholder en la UI.

**Aceptación (Playwright):** abrir el mapa de una zona de ejemplo, hacer zoom y cerrar con Esc.

## T11 · README, plantillas y pre-commit
- `README.md`: qué es, requisitos (Node LTS, Git), instalación paso a paso para Windows y macOS, uso en partida, flujo git (`pull` antes, `commit`/`push` después), cómo crear una ficha.
- `content/README.md`: cada tipo con sus campos y un ejemplo.
- `content/_templates/<tipo>.md` para cada tipo.
- Husky + lint-staged: `validate` + `lint` sobre los ficheros staged.

**Aceptación:** una persona sin contexto puede crear una ficha siguiendo solo el README; un commit con una ficha inválida se bloquea.

## T12 · CI en GitHub Actions
- Workflow en push y PR a `main`: `npm ci`, `validate`, `lint`, `test`, `build`.
- Cache de npm. Opcional: subir `dist/` como artefacto.

**Aceptación:** el workflow pasa en verde con el estado actual y falla si se rompe una ficha.

## T13 · Importador: login y crawl del foro
> Requiere antes: URL y software del foro, y la lista de secciones a bajar. Recomendado: avisar a los admins.
- `scraper/config.ts`: URLs semilla, selectores (lista de hilos, paginación, posts), delay (1500 ms por defecto), user agent identificable.
- `scraper/login.ts`: abre Chromium visible, el humano se loguea y se guarda `scraper/auth.json`.
- `scraper/crawl.ts`: recorre solo las secciones semilla y su paginación, en serie; guarda `scraper/raw/<seccion>/<id>-<slug>.html`, imágenes en `scraper/raw/assets/` e `index.json` (url, título, autor, fecha, sección); reanudable; log de progreso; se para si detecta logout.
- Nunca guarda contraseñas; no baja perfiles de usuario ni mensajes privados.
- Scripts: `npm run scrape:login`, `npm run scrape:crawl`.

**Aceptación:** con una sección pequeña de prueba se generan el HTML y el `index.json`; relanzar no vuelve a bajar lo ya bajado; `git status` no muestra nada de `scraper/raw` ni `auth.json`.

## T14 · Importador: conversión a borradores
- `scraper/convert.ts`: HTML → Markdown con `turndown` (+ plugin GFM para tablas); limpia firmas, citas y boilerplate del foro según config.
- Escribe `content/_inbox/<seccion>/<slug>.md` con un frontmatter mínimo (`title`, `source_url`, `source_date`, `type: borrador`) y copia las imágenes referenciadas a `content/_inbox/assets/`.
- La app y `validate` siguen ignorando `_inbox/`.
- `content/README.md` explica cómo pasar un borrador a ficha real (a mano o con Claude).

**Aceptación:** los HTML de prueba de T13 generan borradores legibles con tablas e imágenes; `npm run validate` sigue pasando.
