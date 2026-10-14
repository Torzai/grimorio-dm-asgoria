# Contenido

Una ficha por fichero `.md`, en la carpeta de su tipo (`pj/`, `npc/`, `zona/`…). Las carpetas que
empiezan por `_` (`_inbox/`, `_templates/`) no salen en la app.

Para crear una ficha, copia la plantilla de su tipo de `_templates/` (`_templates/npc.md` →
`npc/<slug>.md`) y rellena sus campos: las plantillas son la referencia. Un tipo sin fichas sigue
apareciendo en el sidebar, con un 0 y la indicación de cómo crear la primera.

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

La ficha tiene dos pestañas, "Situación" y "Anexos <n>"; si no tiene anexos, no hay pestañas y
solo se ve la situación con su índice.

Campos: `title`, `hilo` (obligatorio), `zona?`, `resumen?`, `importado?`, `importar?`, `tags` y
`relacionados`. Plantilla en `_templates/cronica.md`.

### Seguir un hilo del foro

Los hilos que se importan están en `TRACKED_TOPICS`, en `scraper/config.ts` (como Situación, y
como lore, ver [Lore importado de un hilo](#lore-importado-de-un-hilo-lore)). Para añadir una
Situación, copia una entrada de la lista:

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

## Lore importado de un hilo (`lore/`)

Una ficha de `lore/` también puede venir de un hilo del foro (por ejemplo `lore/cosmos.md`, "Sobre
el cosmos: información para DMs"). Se importa con el mismo motor que la Situación y tiene las
mismas dos secciones:

- `## Contenido`: el post principal (#1). Cada párrafo que empieza con una etiqueta corta en
  negrita (`**Ymir:** …`) abre un bloque: sale en el índice de la pestaña "Contenido" y la
  búsqueda lo encuentra por separado ("El cosmos de Asgoria · Ymir").
- `## Historial`: las respuestas, como **anexos**, con el mismo formato que en la Situación. Si
  el hilo no tiene respuestas, la sección no se escribe.

Una ficha `lore` se ve como una Situación (pestañas "Contenido" y "Anexos <n>", "Narrado por" y
el kicker "Lore · <categoría>") cuando tiene `hilo:` o anexos en `## Historial`. Las demás fichas
lore se ven como siempre. Igual que en la Situación, una ficha sin anexos no muestra la barra de
pestañas: solo el Contenido con su índice.

Campos: `title`, `categoria` (`historia`, `faccion`, `religion`, `cultura`, `cosmologia`, `normas` u
`otro`), `hilo?`, `importado?`, `importar?`, `zona?`, `resumen?`, `tags` y `relacionados`.

### Añadir un hilo de lore

Copia una entrada de `TRACKED_TOPICS` (`scraper/config.ts`) y ponle `type: 'lore'`:

```ts
{
  url: 'https://asgoria.com.ar/foro/topic/sobre-el-cosmos-informacion-para-dms',
  type: 'lore',
  categoria: 'cosmologia',            // obligatoria: la categoría de la ficha al crearla
  slug: 'cosmos',                     // opcional: nombre del fichero; por defecto, el slug del hilo
  title: 'El cosmos de Asgoria',      // opcional: título al crear la ficha
  zona: 'gadelica',                   // opcional, como en la Situación (con zonaTitle)
},
```

`split` y `assign` solo valen para `type: 'cronica'`. Después, los mismos comandos:

```sh
npm run scrape:login                 # solo si la sesión ha caducado
npm run scrape:topics                # baja los hilos nuevos y escribe content/lore/<slug>.md
npm run scrape:topics -- --refresh   # además, vuelve a bajar la última página de cada hilo
npm run validate
```

Al reimportar: se conserva todo el frontmatter (`categoria`, `tags`, `relacionados`…; solo cambian
`hilo` e `importado`), el cuerpo se regenera desde el foro y una ficha con `importar: false` no se
toca.

### PNJ de un hilo de lore (`NPC_LINKS`)

Un hilo de lore que describe PNJ (por ejemplo `lore/casas-nobles-instituciones`, "Casas nobles e
instituciones") puede tener una ficha `npc/` por PNJ, enlazadas en los dos sentidos. Se declaran en
`NPC_LINKS` (`scraper/config.ts`), por slug de la ficha de lore y bloque a bloque:

```ts
'casas-nobles-instituciones': [
  {
    bloque: 's-casa-lancet',          // anchor del bloque (ver abajo)
    nombre: 'Casa Lancet',            // texto del enlace en la ficha del PNJ y su `faccion`
    zona: 'gadelica',                 // opcional: `zona` de sus PNJ
    npcs: [
      {
        slug: 'lady-edith-lancet',    // content/npc/lady-edith-lancet.md
        mention: 'Ledy Edith',        // tal como lo escribe el hilo en ese bloque
        title: 'Lady Edith Lancet',   // opcional: por defecto, la mención
        aliases: ['Edith Lancet'],    // opcional
        // faccion: 'Otra',           // opcional: otra facción; null para ninguna (igual con zona)
      },
      { slug: 'nerya', mention: 'Nerya' },
    ],
  },
],
```

- **Anchor del bloque**: el del índice de "Contenido" (`s-casa-lancet`), el de un anexo
  (`h-2023-08-07-she-wolf`) o el de un bloque dentro de un anexo
  (`h-2023-04-26-she-wolf--el-auditor`). Es lo que queda tras `#` en la dirección al pulsar el bloque
  en el índice o "Enlace a esta entrada" en un anexo.
- En cada `npm run scrape:topics`, la **primera mención** de cada PNJ en su bloque pasa a ser un
  enlace a su ficha (`[[lady-edith-lancet|Ledy Edith]]`), así que se mantiene al reimportar.
- La ficha del PNJ se **crea solo si no existe** ninguna ficha con ese nombre y después nunca se
  vuelve a tocar: lo que escribáis en ella se conserva. Lleva `faccion`, `zona`, `tags: [importado]`,
  `relacionados: [<ficha de lore>]`, la línea "Aparece en …" con el enlace a su bloque (a todos, si
  aparece en varios) y las secciones vacías de la plantilla de NPC.
- Un PNJ que aparece en varios bloques se repite en cada uno con el mismo `slug`; los datos de la
  ficha salen del primero.

**Colores del foro.** En los hilos de información para DMs el color tiene significado: el texto
normal lo sabe todo el mundo y el **azul lo sabe muy poca gente**. Al crear la ficha de un PNJ, el
texto azul de su bloque se copia en ella como un párrafo que empieza por "Secreto poco conocido: ".
Va al PNJ que nombre ese texto o, si no nombra a ninguno, al primero del bloque. La ficha de lore
no cambia: el azul se queda como texto normal. El rojo ("info solo para DM") y los demás colores
no se tratan, y en los hilos de PJ los colores son el color personal de cada DM. Los azules
reconocidos están en `SECRET_COLORS`.

**Enlaces a un bloque.** Cualquier ficha puede enlazar a una parte de otra con
`[[slug#anchor]]` o `[[slug#anchor|texto]]`: abre la ficha en ese bloque o anexo. En el panel
lateral, "Relacionado" lleva al bloque que la ficha enlaza en su texto.

## Oficios (`oficio/`)

Un oficio (Encantamiento, Herrería…) es una ficha con todas sus recetas, agrupadas, y las
habilidades de su progresión. Recetas y habilidades van en el frontmatter; el cuerpo es texto
libre (tiradas, notas):

```yaml
---
type: oficio
title: Encantamiento
resumen: Pergaminos, tintas, círculos mágicos, runas, transmutaciones y piedras de encantamiento.
fuente: Manual de Encantamiento
grupos:
  - nombre: Inscripción de pergaminos
    recetas:
      - nombre: Rollo de pergamino en blanco
        nivel: 1
        dc: 14
        componentes:
          - { nombre: Tallos de juncos, cantidad: 2 }
          - { nombre: Botella de agua, cantidad: 1 }
  - nombre: Runas
    recetas:
      - nombre: 'Runa menor: Nauthiz'
        produce: 5
        nivel: 2
        dc: 16
        componentes:
          - { nombre: Guijarro, cantidad: 5 }
          - { nombre: Encantamiento rúnico menor, cantidad: 1, cargado: true }
          - { nombre: Restos de pieles, cantidad: 1 }
  - nombre: Transmutaciones
    recetas:
      - nombre: 'Transmutar: Polvo de hueso'
        producto: Polvo de hueso
        produce: 3
        nivel: 2
        dc: 15
        componentes:
          - { nombre: Huesos de esqueleto, cantidad: 1 }
          - { nombre: Sales minerales, cantidad: 1 }
habilidades:
  - numero: 1
    nivel: 1
    nombre: Encantador básico
    descripcion: Acceso a la creación de rollos de pergaminos.
  - numero: 2
    nivel: 1
    nombre: Inscribir runas menores
    requiere: 1
    axp: 100
    descripcion: Acceso a la creación de pergaminos con runas menores.
---

## Tiradas

Texto libre: sale en la pestaña "Habilidades y tiradas", debajo de las habilidades.
```

**Recetas.** Cada receta lleva `nombre` y al menos un componente. Lo demás es opcional:

| Campo | Qué es |
|---|---|
| `producto` | Lo que fabrica, si no se llama como la receta ("Transmutar: Polvo de hueso" da "Polvo de hueso"). Varias recetas pueden dar el mismo producto: el polvo elemental sale de dos. |
| `produce` | Unidades que salen de una fabricación (número entero, 1 o más; 1 si falta). Las runas dan 5. |
| `nivel`, `dc` | Nivel de encantador y DC de la tirada (números enteros). |
| `disponible` | `false` para una receta del manual que todavía no se puede hacer; sale atenuada y "No disponible". |
| `requisitos`, `efecto`, `notas` | Una línea de texto cada uno. |

Cada componente lleva `nombre` y `cantidad` (número entero, 1 o más) y, si el manual lo pide
"(Cargado)", `cargado: true`. Si falta algo, `validate` da error y dice el grupo, la receta y el
componente.

**Nombres con dos puntos.** Un nombre como `Runa menor: Nauthiz` va entre comillas simples
(`'Runa menor: Nauthiz'`): sin ellas, YAML confunde los dos puntos con un campo.

**Habilidades.** Cada una lleva `numero`, `nivel`, `nombre` y `descripcion`; `requiere` (el número
de la habilidad previa) y `axp` (su coste) son opcionales.

**Lo que calcula la app** (no se escribe):

- **Componentes.** Cada nombre que aparece como componente o como producto es un componente del
  oficio. Se comparan sin mayúsculas, tildes ni signos: "Runa: Berkana" y "Runa Berkana" son el
  mismo. Es **fabricable** si alguna receta lo produce y **base** si no; la familia (Polvos, Gemas y
  minerales, Runas, Tintas, Pergaminos y círculos, Virutas y restos, Rituales, Otros) sale de cómo
  empieza su nombre. Por eso los nombres tienen que coincidir: "Tinta sulfúrica" en un componente
  es lo que produce la receta "Tinta sulfúrica".
- **Total de materiales base** de cada receta: fabrica antes lo intermedio, cada intermedio las
  veces justas (si una runa da 5 y hacen falta 3, se fabrica una vez y sobran 2) y dice lo que
  sobra. Si un intermedio tiene varias recetas, cuenta con la primera y avisa de las otras.
- **¿Qué puedo fabricar?**: con lo que pongas en el inventario, las recetas que puedes hacer ya,
  las que salen fabricando antes intermedios solo con eso, y las que tienen a lo sumo dos
  componentes de menos (con lo que falta y cuánto). El inventario se guarda en este navegador, uno
  por oficio.

`validate` avisa (warning) si dos recetas se llaman igual, si unas recetas se piden en círculo (A
pide B y B pide A; el desglose se corta ahí), si un `requiere` apunta a una habilidad que no existe,
si dos habilidades tienen el mismo número o si se requieren en círculo.

**En la app.** "Oficios" del sidebar abre el primero (por orden alfabético); cada oficio es una
pestaña de `/oficio/<slug>` con cuatro secciones:

- **Recetas** (`?tab=recetas&r=<receta>`): la lista por grupos, con buscador y chips de grupo y de
  nivel, y la receta elegida con sus componentes, el total de materiales base y dónde se usa.
- **Componentes** (`?tab=componentes&c=<componente>`): la biblioteca por familias, con buscador y
  chips Base/Fabricable y de familia, y el componente elegido con las recetas que lo producen y
  todas las que lo usan.
- **¿Qué puedo fabricar?** (`?tab=fabricar`): el inventario y sus resultados.
- **Habilidades y tiradas** (`?tab=habilidades`): las habilidades por nivel y el cuerpo de la ficha.

La búsqueda encuentra cada receta (también por sus componentes), cada componente y cada habilidad
("Encantamiento · Polvo de zafiro") y los abre en su sección, elegidos. Un enlace
`[[encantamiento#c-polvo-de-zafiro]]` (o `#r-<receta>`, `#h-<número>`) hace lo mismo.

### Añadir un oficio

Para añadir, por ejemplo, Herrería: copia `_templates/oficio.md` a `oficio/herreria.md`, pon el
`title` y escribe sus grupos y recetas. Al lanzar `npm run validate` sale cualquier error, y en la
app aparece una pestaña nueva, "Herrería". Los oficios no se enlazan entre sí: un componente solo
se fabrica si su receta está en el mismo oficio.
