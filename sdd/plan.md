# Plan técnico — Grimorio del DM (Asgoria)

## 1. Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Build | **Vite** (última estable) | Dev server rápido, HMR al editar `.md`, `import.meta.glob` |
| UI | **React** + **TypeScript** strict | Elección del proyecto |
| Routing | **React Router** (`createBrowserRouter`) | URLs limpias; desplegable sin cambios |
| Frontmatter | **`yaml`** + split propio de `---` | `gray-matter` depende de `Buffer` y da problemas en el navegador |
| Validación | **Zod** | Esquemas compartidos entre app y script |
| Markdown | **`react-markdown`** + **`remark-gfm`** | Tablas, sin `dangerouslySetInnerHTML` |
| Wikilinks | Plugin remark propio (`src/content/remark-wikilinks.ts`) | Pequeño y controlado |
| Búsqueda | **MiniSearch** | Fuzzy, prefijo y boost por campo; sin servidor |
| Estilos | **CSS Modules** + `src/styles/tokens.css` | Sin dependencias; tokens centralizados |
| Estado | React state + context mínimo | No hace falta store global |
| Calidad | ESLint (flat config) + Prettier + **Husky** + **lint-staged** | |
| Scripts | **tsx** | Ejecutar `scripts/*.ts` en Node |
| Importador | **Playwright** (lib) + **turndown** | Solo en `scraper/`, nunca en el bundle |

## 2. Estructura del repo

```
/
├─ content/
│  ├─ README.md                 # guía de fichas para DMs
│  ├─ _templates/               # una plantilla por tipo (ignorada por la app)
│  ├─ _inbox/                   # borradores del importador (ignorada por la app)
│  ├─ assets/                   # imágenes y mapas
│  ├─ npc/  zona/  lore/  varita/  comando/  herramienta/  sesion/
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ router.tsx
│  │  └─ AppShell.tsx           # header + sidebar + outlet
│  ├─ content/                  # lógica pura, sin React
│  │  ├─ schemas.ts             # Zod por tipo + unión discriminada
│  │  ├─ frontmatter.ts         # split + parse YAML
│  │  ├─ loader.ts              # glob → Entry[] + ContentIssue[]
│  │  ├─ load-from-fs.ts        # misma API para Node (validate)
│  │  ├─ normalize.ts           # minúsculas, sin tildes, slugify
│  │  ├─ links.ts               # resolución [[...]], backlinks, enlaces rotos
│  │  ├─ remark-wikilinks.ts
│  │  ├─ search-index.ts        # MiniSearch: build + query
│  │  └─ types.ts
│  ├─ features/
│  │  ├─ palette/               # Ctrl+K
│  │  ├─ entry-list/            # lista + filtros
│  │  ├─ entry-view/            # vista de ficha + cards por tipo
│  │  ├─ pins/                  # fijados y recientes
│  │  ├─ image-viewer/
│  │  └─ content-issues/        # aviso de fichas inválidas en dev
│  ├─ ui/                       # piezas visuales reutilizables (Button, Chip, Tag…)
│  ├─ hooks/                    # useLocalStorage, useHotkey…
│  └─ styles/
│     ├─ tokens.css
│     └─ global.css
├─ scripts/
│  └─ validate-content.ts
├─ scraper/                     # tarea final; no se importa desde src/
│  ├─ config.ts                 # URLs semilla, selectores, delay
│  ├─ login.ts  crawl.ts  convert.ts
│  ├─ auth.json                 # gitignored
│  └─ raw/                      # gitignored
├─ sdd/                         # constitution, spec, plan, tasks
└─ README.md
```

## 3. Flujo de datos

```
content/**/*.md
   │  vite-plugin-content.ts (Node: en build y en cada cambio en dev)
   ▼
loader.ts ── frontmatter.ts ── schemas.ts (Zod)
   │            └─► ContentIssue[] (error | warning)
   ▼
Entry[] ──► links.ts · pj-historial.ts · search-index.ts
   │
   ├─► virtual:grimorio/content       (eager)  fichas sin cuerpo, issues, grafo de enlaces,
   │                                            historiales de PJ sin texto y sus agregados
   ├─► virtual:grimorio/search-index  (chunk propio) MiniSearch serializado
   └─► import.meta.glob('/content/**/*.md', { query: '?raw' })  (lazy, un chunk por ficha)
            ▼
ContentContext (React) ─► features/*   ·   useEntryBody(path) ─► cuerpo al abrir la ficha
```

- El navegador arranca solo con los **metadatos**: todo lo de cada ficha menos el cuerpo, más lo que necesitan sidebar, listas, filtros, aside, aviso de issues, resolver de wikilinks y la vista de PJ plegada (por entrada: id, fecha, autor, participantes, recompensa y vista previa).
- El **índice** de búsqueda se carga en un chunk propio cuando el navegador queda ocioso o al usar la búsqueda por primera vez (`search-data.ts`).
- El **cuerpo** de cada ficha es un chunk propio que se importa al abrirla (`use-entry-body.ts`, con caché en memoria). En un PJ, ese cuerpo da la pestaña Ficha y el texto de cada entrada, partido en el cliente con las mismas funciones puras del build (`parseHistorial`, `historialItem`).

- `loader.ts` excluye rutas que empiezan por `_` (`_templates`, `_inbox`) y `assets/`.
- `load-from-fs.ts` lee del disco con `fs` + `fast-glob` (o `fs.readdir` recursivo) y reutiliza **las mismas funciones puras**, para que la app y `validate` nunca diverjan.
- Imágenes: `import.meta.glob('/content/assets/**/*', { query: '?url', import: 'default', eager: true })` → mapa `ruta relativa → URL`.

## 4. Tipos clave

```ts
type EntryType = 'npc' | 'zona' | 'lore' | 'varita' | 'comando' | 'herramienta' | 'sesion';

interface Entry<T extends EntryType = EntryType> {
  slug: string;
  type: T;
  path: string;          // 'content/npc/ejemplo.md'
  data: FrontmatterOf<T>; // inferido de Zod
  body: string;          // markdown sin frontmatter
}

interface ContentIssue {
  path: string;
  level: 'error' | 'warning';
  field?: string;
  message: string;        // en español
}
```

## 5. Búsqueda

- Campos indexados: `title` (boost 4), `aliases` (3), `tags` (2), `resumen` (1.5), `body` (1).
- Opciones: `prefix: true`, `fuzzy: 0.2`, `combineWith: 'AND'`.
- `processTerm` normaliza (minúsculas, sin tildes) **en indexado y en consulta**.
- `storeFields`: `slug`, `type`, `title`, `resumen`, `zona`.
- Se construye en el build (plugin de contenido) y llega serializado en un chunk propio, cargado en idle o al primer uso (§3). En dev se reconstruye al cambiar un `.md`.

## 6. Rutas

| Ruta | Pantalla |
|---|---|
| `/` | Home: fijados, recientes, accesos por tipo, últimas sesiones |
| `/:type` | Lista del tipo; filtros `?zona=&faccion=&tag=` |
| `/:type/:slug` | Ficha |
| `/buscar?q=` | Resultados completos (fallback de la palette) |
| `*` | 404 con buscador |

## 7. Decisiones (ADR-lite)

1. **Metadatos eager, índice y cuerpos bajo demanda (T06c).** El plugin de build hace el trabajo pesado (validar, enlaces, historiales de PJ, índice MiniSearch) y entrega al navegador un módulo de metadatos que se carga al arrancar: fichas sin cuerpo, issues, grafo de enlaces y los historiales de PJ sin el texto de las entradas. El índice serializado va en su propio chunk y se carga en idle o al primer uso de la búsqueda. Cada cuerpo es un chunk que se importa al abrir la ficha; mientras llega, la cabecera, los datos y la lista plegada del historial ya se ven, y el texto muestra "Cargando…". El chunk principal no contiene texto de los cuerpos (salvo las vistas previas, participantes y recompensas del historial), así que crece con el número de fichas, no con lo que ocupa su texto.
2. **Validación en dos sitios con un único código.** En el navegador, para no romper la app; en Node, para bloquear commits y builds rotos.
3. **Sin store global.** Contenido de solo lectura en context; fijados y recientes con un hook sobre `localStorage`.
4. **Wikilinks como plugin remark**, no como regex sobre HTML.
5. **El importador vive aparte (`scraper/`)** y produce borradores en `_inbox/`. Nada del foro llega a la app sin revisión humana.

## 8. Despliegue futuro (no ahora)

Es un sitio estático. Si se despliega: Cloudflare Pages + Cloudflare Access (login por email) para que sea privado. No hace falta tocar código; solo configurar el rewrite SPA a `index.html`.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Fichas heterogéneas a medida que crece | Zod + plantillas + `pre-commit` |
| Slugs duplicados entre carpetas | `validate` lo detecta como error |
| Enlaces rotos al renombrar | Warning en `validate` + estilo visible en la UI |
| El foro cambia el HTML o bloquea el crawler | Selectores en `scraper/config.ts`; ritmo lento; avisar a los admins |
| Kmos y Zai editan la misma ficha | Git; fichas pequeñas reducen los conflictos |
