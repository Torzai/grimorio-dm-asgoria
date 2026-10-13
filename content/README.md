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
