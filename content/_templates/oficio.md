---
type: oficio
title:
# resumen:
# fuente:                   # de dónde salen las recetas, p. ej. Manual de Herrería
# tags: []
grupos:
  - nombre:                 # el grupo, p. ej. Lingotes
    recetas:
      - nombre:             # la receta, p. ej. Lingote de acero
        # producto:         # lo que fabrica, si no se llama como la receta
        # produce: 1        # unidades por fabricación (1 si falta)
        # nivel: 1
        # dc: 15
        # disponible: false # receta del manual que aún no se puede hacer
        componentes:        # al menos uno; cantidad: número entero, 1 o más
          - { nombre: Mineral de hierro, cantidad: 2 }
          - { nombre: Carbón, cantidad: 1 }
          # - { nombre: 'Círculo mágico: Vegvísir', cantidad: 1, cargado: true }
        # requisitos:       # una línea
        # efecto:           # una línea
        # notas:            # una línea, p. ej. Necesita una forja
# habilidades:
#   - numero: 1
#     nivel: 1
#     nombre: Herrero básico
#     descripcion: Acceso a la fundición de lingotes.
#   - numero: 2
#     nivel: 1
#     nombre: Aleaciones
#     requiere: 1             # el número de la habilidad previa
#     axp: 100                # su coste en aXP
#     descripcion: Acceso a las aleaciones de acero.
---

Texto libre opcional (tiradas, notas): sale en la pestaña "Habilidades y tiradas".
Un nombre con dos puntos va entre comillas simples: 'Runa menor: Nauthiz'.
