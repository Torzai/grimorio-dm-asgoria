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

## Crónicas (`cronica/`)

Una crónica es un hilo del foro que cuenta la situación de una región o el avance de una trama.
La ficha tiene dos secciones:

- `## Situación`: el post #1, que su autor va editando. Cada párrafo que empieza con una
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
