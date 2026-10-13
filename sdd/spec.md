# Spec — Grimorio del DM (Asgoria)

## 1. Usuarios

| Usuario | Situación | Necesidad principal |
|---|---|---|
| **DM narrando** | En partida, con NWN en la pantalla principal y el grimorio en la segunda | Encontrar en segundos un NPC, comando o varita aunque recuerde mal el nombre |
| **DM preparando** | Antes de la sesión | Navegar por zona o facción, fijar lo que va a usar y repasar el diario |
| **DM futuro** | Hereda el proyecto | Arrancarlo y añadir fichas sin saber React |

## 2. Historias de usuario

**HU-01 · Búsqueda rápida**
Como DM narrando, quiero pulsar `Ctrl+K` y escribir parte de un nombre para saltar a la ficha sin soltar el teclado.
- Abre desde cualquier pantalla; `Esc` cierra.
- Resultados agrupados por tipo; `↑/↓` navega, `Enter` abre.
- Encuentra con erratas leves ("Sigrund" → "Sigründ") y por prefijo ("var" → varitas).
- Encuentra por alias.
- Muestra la vista previa de la ficha seleccionada.

**HU-02 · Navegar por categoría**
Como DM preparando, quiero ver todas las fichas de un tipo y filtrarlas por zona, facción o tag.
- Sidebar con los tipos y el número de fichas de cada uno.
- Lista ordenada alfabéticamente; los filtros se combinan.
- El estado de los filtros va en la URL (query params), para poder compartir o recargar.

**HU-03 · Leer una ficha**
Como DM, quiero ver cada ficha con un formato adecuado a su tipo.
- NPC: cabecera, datos clave (ubicación, facción, raza/clase, tag del toolset) y secciones.
- Varita: cargas, nivel de lanzador, recarga y uso destacado.
- Comando: sintaxis en monoespaciada con botón de copiar.
- Cualquier tipo: tags, relacionados, "mencionado en" (backlinks) y entradas del diario que la mencionan.

**HU-04 · Enlaces internos**
Como DM, quiero escribir `[[Nombre]]` en una ficha y que sea un enlace a otra.
- Resuelve por slug, título o alias, sin distinguir mayúsculas ni tildes.
- Admite `[[slug|texto visible]]`.
- Admite `[[slug#anchor]]` y `[[slug#anchor|texto]]`: abre la ficha en ese bloque o anexo.
- Un enlace roto se ve distinto (no navegable) y `validate` lo reporta como **warning**.

**HU-05 · Fijados y recientes**
Como DM narrando, quiero fijar las fichas de la sesión y ver las últimas abiertas.
- Botón "Fijar" en cada ficha y en la palette (`Ctrl+Enter`).
- Fijados en el sidebar; recientes (máx. 10) en la home.
- Persisten en `localStorage` y la app funciona aunque `localStorage` falle.

**HU-06 · Imágenes y mapas**
Como DM, quiero ver el mapa de una zona y poder ampliarlo.
- Imágenes en `content/assets/`, referenciadas desde el frontmatter (`mapa`) o el cuerpo.
- Clic: visor a pantalla completa con zoom y desplazamiento.

**HU-07 · Contenido robusto**
Como DM futuro, quiero que si escribo mal una ficha me diga exactamente qué está mal.
- `npm run validate` lista los errores con ruta, campo y motivo, en español.
- En `dev`, las fichas inválidas se excluyen y aparece un aviso con el listado.

**HU-08 · Arranque sencillo**
Como DM futuro, quiero un README que me lleve de cero a la app abierta en menos de 15 minutos.

**HU-09 · Importar el foro (final)**
Como DM, quiero bajar el contenido de referencia del foro con mi sesión para convertirlo en fichas poco a poco.
- Login manual en un navegador visible; la sesión se guarda en `scraper/auth.json` (ignorado por git).
- Crawl limitado a las URLs semilla configuradas, en serie, con 1–2 s entre peticiones y reanudable.
- Guarda HTML en bruto + `index.json` en `scraper/raw/` (ignorado por git).
- Un conversor genera borradores Markdown en `content/_inbox/`, que la app **no** muestra y `validate` ignora.

**HU-10 · Historial de PJ navegable**
Como DM, quiero leer y buscar dentro del historial de un PJ (cientos de quests) y llegar a una entrada concreta desde la búsqueda global.
- Ficha de PJ con cabecera (estado en color, raza · clases · alineamiento · deidad · cuenta), datos (última actividad, quests, en juego desde, DMs distintos, origen) y pestañas "Historial" y "Ficha y trasfondo" (`?tab=ficha`).
- Historial plegado y agrupado por año, del más reciente al más antiguo; cada entrada muestra fecha, narrador, participantes y una vista previa, y se despliega con su texto, su recompensa y "Enlace a esta entrada" (`#h-AAAA-MM-DD-autor`).
- Buscador interno sin tildes ni mayúsculas (`?q=`) que despliega y resalta lo que coincide; filtros por DM, compañero y año, combinables y en la URL.
- Participantes y recompensa se detectan en el texto (lista de nombres al principio; línea "Recompensa…"/"Premios…"); si no encajan, el texto se muestra intacto.
- Panel: "Narrado por", "Suele jugar con" (enlaza a los PJ que existen) y relacionados.
- La búsqueda global indexa cada entrada como resultado propio ("Entrada de historial") y la abre desplegada y resaltada; la ficha se indexa sin el historial.
- Todo se calcula al compilar, no en el navegador.

**HU-11 · Crónicas de región y trama**
Como DM narrando, quiero ver de un vistazo cómo está una región (o una trama) y buscar en lo que se ha ido añadiendo a su hilo.
- Ficha de crónica con cabecera ("Crónica · <zona>", título, "Última actualización DD/MM/AAAA", "Hilo del foro ↗") y pestañas "Situación" (por defecto) y "Anexos <n>" (`?tab=anexos`); sin anexos no hay barra de pestañas y se ve solo la situación con su índice. Lo mismo vale para el lore importado de un hilo ("Contenido").
- "Situación" (post #1): autor y fechas de publicación y edición, índice de los bloques temáticos (párrafos que empiezan con una etiqueta en negrita) y cada bloque bajo su anchor (`#s-<etiqueta>`).
- "Anexos" (las respuestas): en el orden del hilo, plegados, con título propio (primer encabezado o primera línea en negrita, ≤ 80 caracteres; si no, sus primeras palabras), "<autor> · DD/MM/AAAA" y "editado DD/MM/AAAA"; buscador interno y filtro por autor (`?autor=`); un anexo con bloques en negrita lleva mini-índice al desplegarlo.
- Misma lógica de historial que los PJ (parseo, entradas como documentos de búsqueda, anchors, buscador, filtros); "Suele jugar con", participantes y años solo en PJ.
- Panel: "Narrado por" (autores con su nº de posts) y relacionados. La ficha de su zona las lista en "Crónicas de esta zona"; la home, en la caja "Crónicas".
- Búsqueda global: la crónica (sin su situación ni sus anexos), cada bloque de la situación ("Situación de Gadélica · Magia", abre su anchor) y cada anexo (grupo "Historial", "<crónica> · <título>").
- "Última actualización" es la fecha más reciente entre publicaciones y ediciones del hilo; derivada, no se guarda.

**HU-12 · PNJ de un hilo de lore**
Como DM, quiero que cada PNJ que describe un hilo de información (casas nobles, instituciones) tenga su ficha y que el hilo y la ficha se enlacen entre sí, con lo que es secreto bien señalado.
- Los PNJ se declaran en `NPC_LINKS` (`scraper/config.ts`), bloque a bloque; al importar, la primera mención de cada uno en su bloque enlaza a su ficha.
- Su ficha `npc/` se crea si no existe y nunca se sobrescribe: `faccion` (casa o institución), `zona`, `relacionados` (la ficha de lore), "Aparece en …" con enlace a su bloque y las secciones de la plantilla de NPC.
- El texto azul del foro (lo sabe muy poca gente) se copia en la ficha del PNJ con el prefijo "Secreto poco conocido: ". La ficha de lore, las crónicas y los PJ no cambian.
- En el panel de la ficha, "Relacionado" abre la ficha de lore en el bloque del PNJ.

## 3. Modelo de contenido

Un fichero = una ficha. El **slug** es el nombre del fichero sin extensión (kebab-case, único globalmente). La carpeta debe coincidir con `type`.

### Campos comunes

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `type` | enum | sí | `npc`, `pj`, `zona`, `lore`, `cronica`, `varita`, `comando`, `herramienta`, `sesion` |
| `title` | string | sí | |
| `aliases` | string[] | no | Otros nombres o apodos |
| `tags` | string[] | no | kebab-case |
| `resumen` | string | no | Una línea; se usa en listas y en la palette |
| `zona` | slug | no | Debe existir como ficha `zona` (warning si no) |
| `relacionados` | slug[] | no | |
| `actualizado` | fecha ISO | no | |

### Campos por tipo

| Tipo | Campos específicos |
|---|---|
| `npc` | `faccion?`, `raza?`, `clase?`, `ubicacion?`, `tag_toolset?` |
| `pj` | `cuenta_nwn` (obligatorio), `estado` (obligatorio): `activo` \| `inactivo` \| `retirado` \| `muerto`, `sexo?`, `raza?`, `clases?` (string[], máx. 3), `alineamiento?` (texto libre), `deidad?`, `hilo?` (URL del hilo del foro), `importado?` (fecha ISO) |
| `zona` | `region?`, `mapa?` (ruta relativa a `content/assets/`) |
| `lore` | `categoria`: `historia` \| `faccion` \| `religion` \| `cultura` \| `cosmologia` | `normas` | `otro`\| `otro`; `hilo?` (URL del hilo del foro; con él, o con anexos en `## Historial`, la ficha se ve como una crónica, con `## Contenido` en lugar de `## Situación`), `importado?` (fecha ISO), `importar?` (bool) |
| `cronica` | `hilo` (obligatorio, URL del hilo del foro), `importado?` (fecha ISO), `importar?` (bool) |
| `varita` | `cargas?` (int), `nivel_lanzador?` (int), `recarga?` (bool), `uso?` |
| `comando` | `sintaxis` (obligatorio), `ejemplo?`, `ambito`: `jugador` \| `dm` |
| `herramienta` | `uso?`, `donde?` |
| `sesion` | `fecha` (obligatorio), `narradores?` (string[]), `participantes?` (slug[] de PJ) |

### PJ: historial y última actividad

Los NPC los interpretan los DMs; los PJ son los personajes de los jugadores. De un PJ importa sobre todo su historia y saber si sigue activo.

- **Historial**: sección `## Historial` del cuerpo, con una entrada por quest con el formato `### AAAA-MM-DD · Nombre (@usuario)`, de la más reciente a la más antigua. El `(@usuario)` es opcional.
- **Última actividad**: la fecha **máxima** del historial, sea cual sea su orden. Es un dato derivado: no se guarda en el frontmatter. La lista de PJ la muestra en cada tarjeta como `<estado> · Última actividad DD/MM/AAAA`, o `Sin historial`, y se filtra por `estado`.
- **Alineamiento**: texto libre. Se normaliza (minúsculas, sin tildes, género indistinto; *maligno*, *malvado* y *malo* equivalen; *neutral auténtico*, *neutral neutral* y *neutral* son lo mismo) y se compara con los 9 alineamientos de D&D 3.5.
- `validate` da **warning**, nunca error, si el alineamiento no es uno de los 9, si una entrada del historial no tiene el formato o su fecha no existe, y si el historial no va del más reciente al más antiguo.
- **Participantes**: en una `sesion`, `participantes` lista los PJ que jugaron. Cuentan como enlaces en las dos direcciones, así que la sesión aparece en el "Diario de sesiones" de cada PJ. Un participante que no existe o que no es un PJ da **warning**.
- **Privacidad** (constitución P10): se guarda la cuenta de NWN del jugador, nunca su email ni su usuario de Discord.

### Crónica: situación y anexos

Una crónica es un hilo del foro sobre la situación de una región o el avance de una trama. Se importa con `npm run scrape:topics` desde la lista `TRACKED_TOPICS` de `scraper/config.ts`.

- **Situación**: sección `## Situación`, el post #1. Un párrafo que empieza con una etiqueta corta en negrita (≤ 80 caracteres, que no sea una frase acabada en punto) abre un bloque temático; lo anterior a la primera etiqueta es "Situación general". El importador cierra la sección con `_Publicado el DD/MM/AAAA por Nombre_` y `_Editado el DD/MM/AAAA por Nombre_`.
- **Anexos**: sección `## Historial` con el formato de entradas de los PJ (`### AAAA-MM-DD · Nombre (@usuario)`), en el **orden del hilo**: `validate` no exige que vaya del más reciente al más antiguo.
- **Última actualización**: la fecha máxima entre publicaciones y ediciones (las notas del importador incluidas). Derivada, como la última actividad de un PJ.
- Al reimportar se conserva el frontmatter (solo cambian `hilo` e `importado`), se regenera el cuerpo y `importar: false` protege la ficha. Si la zona del hilo no existe, se crea una ficha mínima (`title`, `tags: [importado]`).

### Convenciones de cuerpo (recomendadas, no validadas)

- NPC: `## Cómo interpretarlo`, `## Qué sabe`, `## Ganchos`.
- PJ: `## Descripción Física`, `## Origen`, `## Objetivos`, `## Otras Notas` y `## Historial` (este con el formato de arriba, que sí se valida).
- Crónica: `## Situación` y `## Historial` (los anexos, con el formato de arriba).
- Varita: `## Efecto`, `## Reglas del server`.
- Sesión: texto libre con `[[enlaces]]` a lo que apareció.

### Ejemplo

```markdown
---
type: npc
title: "[Nombre del NPC]"
aliases: ["[apodo]"]
tags: [mercader]
resumen: "Vende varitas en el puerto"
zona: puerto-ejemplo
faccion: "[Facción]"
tag_toolset: npc_ejemplo_01
---

## Cómo interpretarlo
...
```

> Las fichas de ejemplo del repo usan contenido **ficticio y claramente marcado** (`tags: [ejemplo]`). El lore real se mete a mano o con el importador.

## 4. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Búsqueda < 50 ms con 2.000 fichas |
| RNF-02 | Carga inicial en `dev` < 2 s con 500 fichas |
| RNF-03 | Usable de 1280 px a 1920 px de ancho (segunda pantalla); no se rompe a 390 px |
| RNF-04 | Contraste AA y navegación completa por teclado |
| RNF-05 | Sin peticiones de red en runtime salvo Google Fonts |
| RNF-06 | Node LTS ≥ 22; Windows, macOS y Linux |

## 5. Fuera de alcance

- Login, usuarios o roles dentro de la app.
- Editar fichas desde la UI (se editan los `.md`; como mucho, un botón "Abrir en editor" vía `vscode://`).
- Sincronización en tiempo real entre DMs (se usa git).
- Despliegue público (posible en el futuro; ver `plan.md` §8).
- Integración directa con el juego o el servidor NWN.
