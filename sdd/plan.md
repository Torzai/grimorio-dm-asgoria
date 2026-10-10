# Plan técnico — Grimorio del DM (Asgoria)

## 1. Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Build | **Vite** (última estable) | Dev server rápido, HMR al editar `.md`, `import.meta.glob` |
| UI | **React** + **TypeScript** strict | Elección del proyecto |
| Routing | **React Router** (`createBrowserRouter`) | URLs limpias; desplegable sin cambios |
| Frontmatter | **`yaml`** + split propio de `---` | `gray-matter` depende de `Buffer` y da problemas en el navegador |
| Validación | **Zod** | Esquemas compartidos entre app, script y tests |
| Markdown | **`react-markdown`** + **`remark-gfm`** | Tablas, sin `dangerouslySetInnerHTML` |
| Wikilinks | Plugin remark propio (`src/content/remark-wikilinks.ts`) | Pequeño y controlado |
| Búsqueda | **MiniSearch** | Fuzzy, prefijo y boost por campo; sin servidor |
| Estilos | **CSS Modules** + `src/styles/tokens.css` | Sin dependencias; tokens centralizados |
| Estado | React state + context mínimo | No hace falta store global |
| Tests | **Vitest** + **@testing-library/react** | Lógica y componentes |
| E2E | **Playwright** | Verificación de tareas de UI |
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
│  │  ├─ load-from-fs.ts        # misma API para Node (validate/tests)
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
├─ e2e/                         # specs Playwright
├─ sdd/                         # constitution, spec, plan, tasks
└─ README.md
```

## 3. Flujo de datos

```
content/**/*.md
   │  import.meta.glob('/content/**/*.md', { query: '?raw', import: 'default', eager: true })
   ▼
loader.ts ── frontmatter.ts ── schemas.ts (Zod)
   │            └─► ContentIssue[] (error | warning)
   ▼
Entry[]  ──► links.ts (resolver, backlinks, rotos)
   │
   ├─► search-index.ts (MiniSearch, construido una vez al arrancar)
   └─► ContentContext (React) ─► features/*
```

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
- Se construye una vez y se expone desde `ContentContext`. Con HMR se reconstruye.

## 6. Rutas

| Ruta | Pantalla |
|---|---|
| `/` | Home: fijados, recientes, accesos por tipo, últimas sesiones |
| `/:type` | Lista del tipo; filtros `?zona=&faccion=&tag=` |
| `/:type/:slug` | Ficha |
| `/buscar?q=` | Resultados completos (fallback de la palette) |
| `*` | 404 con buscador |

## 7. Decisiones (ADR-lite)

1. **Carga eager del contenido.** Con miles de fichas de texto, el peso es asumible y simplifica la búsqueda. Si algún día pesa demasiado, se pasa a `eager: false` para los cuerpos y se mantiene el índice eager.
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
