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
| T06b | Tipo PJ, participantes en sesión y fix del bundle | T06 | 🎭 Sí |
| T06c | Contenido a escala ✅ | T06b | No |
| T06d | Historial de PJ navegable | T06c | 🎭 Sí |
| T07 | Cards por tipo | T06 | No |
| T08 | Command palette Ctrl+K ✅ | T06 | No |
| T09 | Fijados y recientes + home ✅ | T08 | No |
| T10 | Imágenes y visor de mapas | T06 | No |
| T11 | README, plantillas y pre-commit | T02 | No |
| T12 | CI en GitHub Actions | T11 | No |
| T13 | Importador: login y crawl del foro (✅ para PJ) | T12 | No |
| T14 | Importador: conversión a borradores (✅ para PJ) | T13 | No |
| T15 | Tipo crónica e importador de hilos seguidos | T06d, T14 | 🎭 Sí |
| T15b | Situación por regiones: hilos multi-región | T15 | 🎭 Sí |
| T15c | Lore importado de un hilo (cosmología) | T15b | 🎭 Sí |

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

## T06b · Tipo PJ, participantes en sesión y fix del bundle 🎭
- `load-from-glob.ts` excluye `/content/_*/**` en el propio `import.meta.glob`: ni `_inbox` ni `_templates` llegan a `dist/`.
- Tipo `pj` (spec §3): esquema Zod, etiquetas "PJ" / "Personajes (PJ)" justo después de NPCs, plantilla `content/_templates/pj.md`.
- Lógica pura en `src/content/pj.ts`: `parseHistorial`, `ultimaActividad` (fecha máxima, derivada) y `normalizeAlignment`; warnings en `validate` para alineamiento desconocido, entradas mal formadas y historial desordenado.
- `participantes` (slug[] de PJ) en `sesion`, enlazados en las dos direcciones; warning si no existe o no es un PJ.
- Lista de PJ: filtro "Estado" y línea `<estado> · Última actividad DD/MM/AAAA` (o `Sin historial`).
- Contenido: 3 PJ de ejemplo y el borrador de Einar promovido a `content/pj/`.

**Aceptación (comprobación manual en el navegador):** `validate`, `lint` y `build` en verde; el sidebar muestra "Personajes (PJ)" tras NPCs; `/pj` lista estado y última actividad y el filtro Estado funciona; un PJ muestra su historial del más reciente al más antiguo y en "Diario de sesiones" las sesiones en las que participó; `dist/` no contiene texto de `_inbox` ni de `_templates`.

## T06c · Contenido a escala
- Índice de búsqueda generado en build (MiniSearch serializado) en lugar de construirse al arrancar.
- Cuerpos cargados bajo demanda (`eager: false`), manteniendo el índice y el frontmatter eager.

**Aceptación (comprobación manual en el navegador):** `validate`, `lint` y `build` en verde; la búsqueda encuentra fichas sin cargar sus cuerpos y abrir una ficha muestra su cuerpo completo.

**Estado:** ✅ hecha. Arquitectura final en `plan.md` §3 y ADR-1.

## T06d · Historial de PJ navegable 🎭
- Lógica pura en `src/content/pj.ts` y `pj-historial.ts`: entradas del historial con id estable, participantes y recompensa detectados, vista previa y agregados (DMs, compañeros, años); calculado en el build por `vite-plugin-content.ts`.
- Vista `src/features/entry-view/pj/`: cabecera y datos de `sdd/design/maqueta-pj.html`, pestañas ARIA (`?tab=ficha`), historial por años con buscador (`?q=`), filtros DM/Con/año, entradas desplegables y aside "Narrado por" / "Suele jugar con".
- Búsqueda global: un documento por entrada (`<slug>#<id>`) que abre `/pj/<slug>?tab=historial&q=…#<id>`; la ficha se indexa sin historial.

**Aceptación (comprobación manual en el navegador):** `validate`, `lint` y `build` en verde; `/pj/einar-eriksson` se lee como la maqueta; buscar "drak" deja solo las entradas que lo mencionan, desplegadas y con `<mark>`; "DM: Mimir" + 2023 filtra; buscar "Drak'Nar" en la cabecera lleva a la entrada desplegada y resaltada; "Ficha y trasfondo" no contiene historial.

## T07 · Cards por tipo
- Bloque de datos clave específico por tipo (spec HU-03): NPC, varita, comando (con botón Copiar sintaxis), herramienta, zona (miniatura del mapa si la hay), lore (categoría), sesión (fecha, narradores).
- Registro `type → componente`; un tipo sin card usa el bloque genérico.

**Aceptación (comprobación manual en el navegador):** cada tipo de ejemplo muestra sus campos; Copiar pone la sintaxis en el portapapeles.

## T08 · Command palette Ctrl+K ✅
- `Ctrl+K` / `Cmd+K` abre desde cualquier ruta; también el campo del header. `Esc` cierra y devuelve el foco.
- Input con resultados agrupados por tipo, chips para filtrar por tipo, vista previa a la derecha.
- `↑/↓`, `Enter` abre, `Ctrl+Enter` fija (por ahora solo un stub hasta T09).
- Accesible: `role="dialog"`, `aria-modal`, foco atrapado, `aria-activedescendant` en la lista.
- `/buscar?q=` muestra los resultados completos.

**Aceptación (comprobación manual en el navegador):** abrir con atajo, escribir con una errata, navegar con flechas y abrir con Enter; Esc cierra y devuelve el foco.

## T09 · Fijados y recientes + home ✅
- Hook `useLocalStorage` tolerante a fallos.
- Fijar/desfijar desde la ficha y desde la palette; fijados en el sidebar.
- Recientes (máx. 10, sin duplicados) al abrir una ficha.
- Home: fijados, recientes, accesos por tipo y últimas 3 sesiones.

**Aceptación (comprobación manual en el navegador):** fijar persiste tras recargar; los recientes se ordenan del más nuevo al más antiguo; con `localStorage` bloqueado la app sigue funcionando.

## T10 · Imágenes y visor de mapas
- Resolver imágenes de `content/assets/` en el frontmatter (`mapa`) y en el cuerpo (rutas relativas).
- `features/image-viewer`: pantalla completa, zoom con rueda o botones, arrastre, `Esc` para cerrar. Sin librería salvo justificación.
- Imagen que no existe → issue en `validate` y placeholder en la UI.

**Aceptación (comprobación manual en el navegador):** abrir el mapa de una zona de ejemplo, hacer zoom y cerrar con Esc.

## T11 · README, plantillas y pre-commit
- `README.md`: qué es, requisitos (Node LTS, Git), instalación paso a paso para Windows y macOS, uso en partida, flujo git (`pull` antes, `commit`/`push` después), cómo crear una ficha.
- `content/README.md`: cada tipo con sus campos y un ejemplo.
- `content/_templates/<tipo>.md` para cada tipo.
- Husky + lint-staged: `validate` + `lint` sobre los ficheros staged.

**Aceptación:** una persona sin contexto puede crear una ficha siguiendo solo el README; un commit con una ficha inválida se bloquea.

## T12 · CI en GitHub Actions
- Workflow en push y PR a `main`: `npm ci`, `validate`, `lint`, `build`.
- Cache de npm. Opcional: subir `dist/` como artefacto.

**Aceptación:** el workflow pasa en verde con el estado actual y falla si se rompe una ficha.

## T13 · Importador: login y crawl del foro
> Requiere antes: URL y software del foro, y la lista de secciones a bajar. Recomendado: avisar a los admins.
> Ya existe un spike para hilos de PJ en `/scraper/` (login, descarga de un hilo y `posts.json`): T13 lo generaliza a secciones.
- `scraper/config.ts`: URLs semilla, selectores (lista de hilos, paginación, posts), delay (1500 ms por defecto), user agent identificable.
- `scraper/login.ts`: abre Chromium visible, el humano se loguea y se guarda `scraper/auth.json`.
- `scraper/crawl.ts`: recorre solo las secciones semilla y su paginación, en serie; guarda `scraper/raw/<seccion>/<id>-<slug>.html`, imágenes en `scraper/raw/assets/` e `index.json` (url, título, autor, fecha, sección); reanudable; log de progreso; se para si detecta logout.
- Nunca guarda contraseñas; no baja perfiles de usuario ni mensajes privados.
- Scripts: `npm run scrape:login`, `npm run scrape:crawl`.

**Aceptación:** con una sección pequeña de prueba se generan el HTML y el `index.json`; relanzar no vuelve a bajar lo ya bajado; `git status` no muestra nada de `scraper/raw` ni `auth.json`.

**Estado:** ✅ hecha para PJ (los dos subforos `personajes` y `personajes-femeninos`, tratados como una sola lista). Falta generalizar a otras secciones del foro.
- `npm run scrape:discover-pjs` → `scraper/raw/pj/_index.json` (url, título, subforo, respuestas, último post relativo).
- `npm run scrape:pjs -- [--limit N] [--only <slug>]… [--refresh]` → `scraper/raw/pj/<hilo>/page-NN.html` + `posts.json`, log en `scraper/raw/pj/_crawl.log`. Baja todos los hilos completos, sin saltar ninguno, y termina con el mismo resumen que `scrape:convert-all`.

## T14 · Importador: conversión a borradores
> Ya existe un spike para hilos de PJ en `/scraper/` (`convert-pj.ts` → `content/_inbox/pj/`): T14 lo generaliza a otros tipos de hilo.
- `scraper/convert.ts`: HTML → Markdown con `turndown` (+ plugin GFM para tablas); limpia firmas, citas y boilerplate del foro según config.
- Escribe `content/_inbox/<seccion>/<slug>.md` con un frontmatter mínimo (`title`, `source_url`, `source_date`, `type: borrador`) y copia las imágenes referenciadas a `content/_inbox/assets/`.
- La app y `validate` siguen ignorando `_inbox/`.
- `content/README.md` explica cómo pasar un borrador a ficha real (a mano o con Claude).

**Aceptación:** los HTML de prueba de T13 generan borradores legibles con tablas e imágenes; `npm run validate` sigue pasando.

**Estado:** ✅ hecha para PJ, que se escriben directamente como fichas reales en `content/pj/` (no en `_inbox/`).
- `npm run scrape:convert-all -- [--only <hilo>]…` → `content/pj/<personaje>.md`; informe en `scraper/raw/pj/_convert-report.txt`.
- Ningún hilo de `_index.json` se pierde: cada uno acaba importado con formulario, importado como `ficha-libre` (post #1 sin formulario: nombre y cuenta del título, sexo del subforo y el post entero en "## Trasfondo"), excluido con su motivo (normas, plantillas o avisos del staff cuyo título no sigue "Nombre ( Cuenta )") o fallido con su error. El informe acaba con los totales de los cuatro grupos.
- Ficha nueva: `estado` según el último post del hilo (< 180 días → `activo`). Ficha existente: conserva su frontmatter, actualiza `hilo` e `importado` y regenera el cuerpo; con `importar: false` no se toca.
- Reimportar: `npm run scrape:pjs -- --refresh` y después `npm run scrape:convert-all`. Ver `content/README.md`.

## T15 · Tipo crónica e importador de hilos seguidos 🎭
- Tipo `cronica` (spec §3 y HU-11): esquema Zod (`hilo` obligatorio, `importado?`, `importar?`), etiquetas "Crónica" / "Crónicas" tras "Lore y facciones", plantilla `content/_templates/cronica.md`.
- Historial genérico para cualquier tipo con `## Historial`: parseo en `src/content/historial.ts` con un perfil por tipo (orden por fecha o del hilo, título por fecha y autor o detectado, participantes solo en PJ); items y agregados en `historial-items.ts`; datos del navegador en `historial-data.ts`. Estructura de los posts (etiquetas en negrita, título, notas del importador) en `post-structure.ts`; situación y datos derivados de la crónica en `cronica.ts`.
- Vista `src/features/entry-view/cronica/`: pestañas "Situación" (índice y bloques con anchor) y "Anexos" (el `HistorialPanel` de los PJ, movido a `entry-view/historial/`), aside "Narrado por". Pestañas y "Narrado por" compartidos con la vista de PJ.
- Búsqueda global: cada bloque de la situación y cada anexo son documentos propios; palette con grupo "Crónicas" y los anexos en "Historial".
- Zona: caja "Crónicas de esta zona". Home: caja "Crónicas" con la última actualización.
- Importador: `TRACKED_TOPICS` en `scraper/config.ts`; `npm run scrape:topics [-- --refresh]` baja cada hilo con el crawl de siempre y escribe `content/<tipo>/<hilo>.md` con el motor de limpieza de PJ; conserva el frontmatter, respeta `importar: false` y crea la ficha mínima de la zona si falta.

**Aceptación (comprobación manual en el navegador):** `validate`, `lint` y `build` en verde; "Crónicas" en el sidebar; `/cronica/topico-situacion-actual-gadelica` (hoy `/cronica/situacion-gadelica`, ver T15b) muestra la situación con su índice y los anexos buscables y filtrables por autor; buscar en la palette un término del hilo devuelve la crónica, un bloque o un anexo; `/zona/gadelica` enlaza a la crónica; la home muestra la caja "Crónicas"; `/pj/einar-eriksson` sigue igual.

**Estado:** ✅ hecha con el hilo de Gadélica.

## T15b · Situación por regiones: hilos multi-región 🎭
- Etiquetas: el tipo `cronica` se muestra como "Situación" / "Situación por regiones" (sidebar, palette, home, kickers); la caja de la zona pasa a "Situación de esta zona". El `type`, las carpetas y los esquemas no cambian.
- Lista "Situación por regiones": orden alfabético por región (título de su zona; sin zona, al final) y línea meta "Última actualización DD/MM/AAAA".
- `TRACKED_TOPICS` admite `slug?` (nombre del fichero; Gadélica pasa a `content/cronica/situacion-gadelica.md` con su frontmatter), `split?` (regiones con `keywords` para partir un hilo multi-región) y `assign?` (nº de post → región o `'general'`, manda sobre la deducción). Lógica en `scraper/lib/region-split.ts`; los posts guardan su anchor (`postid-N`) para que `hilo` apunte al primer post de cada región.
- Hilo "Situación otras regiones" partido en una ficha por región (Arvandor, Dhu Nun, Karak, Loren, Monteverde, Mraganur), con las zonas mínimas que faltaban. Decisión de los DMs (13/10/2026): los posts dudosos van a Mraganur ("Mrag" es su pueblo, no otra región) salvo el círculo druídico de Loren (#4) y los tips de la Arboleda (#5), que van a Loren.
- Documentado en `content/README.md` ("Partir un hilo que mezcla regiones").

**Aceptación (comprobación manual en el navegador):** `validate`, `lint` y `build` en verde; el sidebar muestra "Situación por regiones" con una ficha por región, Gadélica incluida; cada ficha enlaza con su zona y la zona muestra su situación; `/cronica/situacion-gadelica` funciona; los posts #4 y #5 están en la ficha de Loren y los demás dudosos en la de Mraganur; buscar "Arboleda" en la palette lleva a la ficha de Loren.

**Estado:** ✅ hecha.

## T15c · Lore importado de un hilo (cosmología) 🎭
- `lore.categoria` admite `cosmologia` ("Cosmología") y `lore` admite `hilo?`, `importado?` e `importar?`, como `cronica`. La lista de lore gana el filtro "Categoría" (`?categoria=`).
- `TRACKED_TOPICS` admite `type: 'lore'` con `categoria` obligatoria. Mismo motor que la Situación: el post #1 va bajo `## Contenido` (`## Situación` en `cronica`) y las respuestas son anexos en `## Historial`. `cronica-draft.ts` y `sync-topics.ts` reciben el tipo de destino; el título de la sección sale de `THREAD_PROFILES` (`src/content/cronica.ts`), el mismo perfil que lee el visor. Reimportar conserva el frontmatter y respeta `importar: false`.
- Una ficha `lore` usa la vista de la Situación (`CronicaView`, común a ambos tipos) cuando viene de un hilo (`hilo:`) o tiene anexos en `## Historial`: pestañas "Contenido" (con índice de bloques) y "Anexos <n>", aside "Narrado por" y kicker "Lore · <categoría>". Una ficha sin anexos (lore o cronica) no muestra la barra de pestañas: solo el contenido con su índice. `HISTORIAL_TYPES` incluye `lore`, con el mismo perfil que `cronica`. Las demás fichas lore se ven como siempre.
- Búsqueda: cada bloque del Contenido y cada anexo son resultados propios ("El cosmos de Asgoria · Ymir").
- Hilo importado: `lore/cosmos` ("El cosmos de Asgoria", `cosmologia`). Documentado en `content/README.md`.

**Aceptación (comprobación manual en el navegador):** `validate`, `lint` y `build` en verde; `/lore/cosmos` (sin anexos) se ve como una ficha de Situación sin barra de pestañas, con su índice y el kicker "Lore · Cosmología"; una Situación con anexos conserva sus pestañas; la lista "Lore y facciones" filtra por categoría "Cosmología"; buscar en la palette un término de un bloque abre `/lore/cosmos` en ese bloque; `/cronica/situacion-gadelica` y los PJ siguen igual.

**Estado:** ✅ hecha.
