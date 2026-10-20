# Retratos del equipo

Imágenes WebP optimizadas desde las fotografías aportadas en `img/equipo-de-trabajo/`. Las fotos originales se conservan sin cambios. Los encuadres completos se presentan sobre una superficie adaptable al tema.

Elizabeth: fondo retirado mediante la herramienta integrada de edición de imágenes. Instrucción utilizada: aislar únicamente a la mujer del primer plano con cabello rizado, gafas y blusa gris; retirar aula y otras personas; conservar identidad, expresión, cabello, ropa y joyas; exportar con transparencia. No se alteraron las demás fotografías mediante generación de imágenes.

Para optimizar nuevamente se usa `scripts/prepare-team-assets.cjs`, con Sharp disponible a través de `ENSENAS_RUNTIME_PACKAGES`. El recorte se proporciona mediante `ENSENAS_ELIZABETH_CUTOUT`; sin esa variable se conserva el WebP existente de Elizabeth, evitando sobrescribirlo con la foto de grupo.
