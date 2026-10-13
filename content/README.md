# Contenido

Una ficha por fichero `.md`, en la carpeta de su tipo (`pj/`, `npc/`, `zona/`…). Plantillas en
`_templates/`. Las carpetas que empiezan por `_` (`_inbox/`, `_templates/`) no salen en la app.

## PJ importados del foro

Las fichas de `pj/` con `hilo:` vienen de los subforos de personajes del foro. Para traer los
posts nuevos:

```sh
npm run scrape:login                 # solo si la sesión ha caducado
npm run scrape:discover-pjs          # lista de hilos (detecta PJ nuevos)
npm run scrape:pjs -- --refresh      # baja la última página de cada hilo y las que falten
npm run scrape:convert-all           # escribe content/pj/
npm run validate
```

Al reimportar una ficha que ya existe:

- Se conserva **todo** su frontmatter (`estado`, `zona`, `relacionados`, `aliases`, `tags`…);
  solo se actualizan `hilo` e `importado`.
- El cuerpo (ficha + `## Historial`) se **regenera** desde el foro: lo que escribas a mano debajo
  del frontmatter se pierde.
- `estado` solo se calcula al crear la ficha (activo si el último post tiene menos de 180 días).

Ningún hilo de los subforos se queda fuera en silencio. Si el post #1 no tiene un formulario
legible, la ficha se crea igual con el tag `ficha-libre`: nombre y cuenta salen del título del
hilo, el sexo del subforo y el post entero va en `## Trasfondo` (el resto de campos, a mano).
Solo se excluyen normas, plantillas y avisos del staff, y el informe
(`scraper/raw/pj/_convert-report.txt`) dice por qué.

Para que el importador no vuelva a tocar una ficha, añade a su frontmatter:

```yaml
importar: false
```

## Situación por regiones (`cronica/`)

En la app este tipo se llama **Situación** ("Situación por regiones" en el sidebar); por dentro
sigue siendo `cronica` (carpeta, `type` y rutas `/cronica/<slug>`). Cada ficha cuenta la situación
de una región (o el avance de una trama) a partir de un hilo del foro, y su `zona` es la región:
la ficha de la zona la enlaza en "Situación de esta zona". La lista se ordena por región.
La ficha tiene dos secciones:

- `## Situación`: el post principal (el #1, que su autor va editando). Cada párrafo que empieza con una
  etiqueta corta en negrita (`**Magia:** …`) abre un bloque: sale en el índice de la pestaña
  "Situación" y la búsqueda lo encuentra por separado ("Situación de Gadélica · Magia").
- `## Historial`: las respuestas, como **anexos**, en el orden del hilo y con el mismo formato
  de entrada que los PJ (`### AAAA-MM-DD · Nombre (@usuario)`). El título de cada anexo es su
  primer encabezado o su primera línea en negrita; si no tiene, sus primeras palabras.

Campos: `title`, `hilo` (obligatorio), `zona?`, `resumen?`, `importado?`, `importar?`, `tags` y
`relacionados`. Plantilla en `_templates/cronica.md`.

### Seguir un hilo del foro

Los hilos que se importan como crónica están en `TRACKED_TOPICS`, en `scraper/config.ts`. Para
añadir uno, copia una entrada de la lista:

```ts
{
  url: 'https://asgoria.com.ar/foro/topic/<hilo>',
  type: 'cronica',
  zona: 'gadelica',          // opcional: slug de la zona
  zonaTitle: 'Gadélica',     // opcional: título si hay que crear la ficha de zona
  title: 'Situación actual de Gadélica', // opcional: título al crear la ficha
  slug: 'situacion-gadelica', // opcional: nombre del fichero; por defecto, el slug del hilo
},
```

Y después:

```sh
npm run scrape:login                 # solo si la sesión ha caducado
npm run scrape:topics                # baja los hilos nuevos y escribe content/cronica/<hilo>.md
npm run scrape:topics -- --refresh   # además, vuelve a bajar la última página de cada hilo
npm run validate
```

Al reimportar, igual que con los PJ: se conserva todo el frontmatter (solo cambian `hilo` e
`importado`), el cuerpo se regenera y una ficha con `importar: false` no se toca. Si la zona del
hilo no tiene ficha, se crea una mínima (`title` y `tags: [importado]`) para que el enlace
funcione; su contenido se escribe a mano.

### Partir un hilo que mezcla regiones (`split`)

Un hilo como "Situación otras regiones" habla de varias regiones a la vez. Con `split`, el
importador escribe **una ficha por región** (`content/cronica/situacion-<región>.md`, título
"Situación de <Región>", `zona: <región>`) en lugar de una sola:

```ts
{
  url: 'https://asgoria.com.ar/foro/topic/situacion-otras-regiones',
  type: 'cronica',
  title: 'Situación general de otras regiones', // ficha de lo que quede sin región
  split: {
    regions: [
      { slug: 'karak', title: 'Karak' },
      // keywords: lugares, NPCs y facciones que sitúan un post en la región
      { slug: 'mraganur', title: 'Mraganur', keywords: ['Mrag', 'Hadka', 'Vinter'] },
    ],
  },
  assign: { 4: 'loren', 6: 'mraganur' }, // nº de post → región, decidido a mano
},
```

Cómo reparte los posts, en este orden:

1. **`assign`**: si el número del post está ahí, el post entero va a esa región (un `slug` de
   `regions` o `'general'`). Manda sobre todo lo demás y se respeta en cada reimportación.
2. **Encabezados**: una línea en negrita que solo es el nombre de una región (`**Karak**`,
   `**En Karak:**`, `**Situación de Karak**`) abre la parte de esa región dentro del post; así
   un post que resume varias regiones se reparte entre ellas.
3. **Deducción**: un post sin encabezados va entero a la región cuyo nombre y `keywords`
   menciona más. Confianza *alta* si nombra dos o más términos de esa región y de ninguna otra,
   *media* si una región destaca, *baja* si no nombra ninguna o hay empate; en ese caso va a la
   ficha general.

En cada región, su primera parte en el orden del hilo es la `## Situación` (con su índice de
bloques) y el resto son sus anexos en `## Historial`. `hilo` apunta al primer post de la región
(`…#postid-218`) si está en la primera página del hilo. Lo que quede sin región va a una ficha
con el slug del hilo y el `title` del tema; si no queda nada, esa ficha no se crea. Las zonas que
falten se crean mínimas con el `title` de la región.

El informe de `scrape:topics` lista, sin textos, cada post con su región y cómo se decidió
(`encabezados`, `auto, <confianza>` o `manual; deducida <región>, <confianza>`). Para corregir
un reparto, añade el número del post a `assign` y vuelve a lanzar
`npm run scrape:topics -- --refresh`. Si una región se queda sin posts, su ficha anterior no se
borra sola: bórrala a mano o márcala `importar: false`.
