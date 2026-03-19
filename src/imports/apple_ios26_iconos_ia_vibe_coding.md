# Especificación para IA de vibe coding: iconos de apps Apple para iPhone en iOS 26 con Liquid Glass

## Objetivo
Generar desde cero un icono de app que se vea correcto en iPhone con iOS 26, siguiendo lineamientos oficiales de Apple para **App Icons**, **Liquid Glass** e **Icon Composer**.

## Regla de oro
Si Apple **no publica un valor numérico exacto**, no lo inventes. En esos casos:

1. usa la **plantilla oficial** de Apple;
2. trata el dato como **template-defined**;
3. evita afirmar radios, márgenes o máscaras “exactas” que Apple no haya documentado en texto.

---

## 1) Qué exige Apple en el flujo moderno

### 1.1 Archivo base y herramienta
- Apple introdujo **Icon Composer** para crear iconos multicapa con **Liquid Glass** desde un solo diseño para iPhone, iPad, Mac y Apple Watch.
- El flujo recomendado es:
  1. diseñar en Figma / Sketch / Photoshop / Illustrator;
  2. exportar capas;
  3. ajustar materiales y variantes en **Icon Composer**;
  4. entregar a **Xcode** un archivo `.icon`.
- Xcode integra el nuevo formato y genera los assets necesarios para las plataformas soportadas.

### 1.2 Capas y estructura
- Un icono moderno parte de una **capa de fondo** y **una o más capas de primer plano**.
- En Icon Composer, las capas se organizan en **groups** que controlan apilado y propiedades de vidrio.
- Apple indica que normalmente basta con **hasta 4 grupos**.

### 1.3 Materialidad y comportamiento visual
- El sistema añade o controla propiedades como:
  - **translucency**;
  - **frostiness**;
  - **specular highlights**;
  - **blur**;
  - **per-layer shadows**.
- En iPhone, el icono puede mostrar reflejos y brillo especular que reaccionan al movimiento y a la iluminación del sistema.

---

## 2) Medidas y canvas confirmados por Apple

### 2.1 Canvas maestro
- **iPhone / iPad / Mac:** `1024 x 1024 px`
- **Apple Watch:** `1088 x 1088 px`

### 2.2 Tamaños de salida relevantes para iPhone
- **App Store:** `1024 x 1024 px`
- **Home Screen iPhone:** `60 x 60 pt`
  - `120 x 120 px` (@2x)
  - `180 x 180 px` (@3x)
- **Spotlight iPhone:** `40 x 40 pt`
  - `80 x 80 px` (@2x)
  - `120 x 120 px` (@3x)
- **Settings iPhone:** `29 x 29 pt`
  - `58 x 58 px` (@2x)
  - `87 x 87 px` (@3x)
- **Notification iPhone:** `20 x 20 pt`
  - `40 x 40 px` (@2x)
  - `60 x 60 px` (@3x)

### 2.3 Cómo usar estas medidas
- Diseña el **master** en `1024 x 1024 px`.
- No dibujes una versión diferente por cada tamaño si no es necesario.
- En el flujo moderno, la prioridad es entregar un `.icon` correcto a Xcode.

---

## 3) Bordes, máscara, radio de esquina y crop

### 3.1 Lo que sí está confirmado
- Apple actualizó la retícula de iconos con una estructura más simple y espaciada.
- Apple dice explícitamente que el nuevo sistema usa un **rounded rectangle** con un **corner radius más redondo** que antes.
- Apple también indica que el **canvas shape actúa como máscara**.
- Apple recomienda usar las **production templates** y las **grids** oficiales para colocar el arte.

### 3.2 Lo que NO debes inventar
- No afirmes un **corner radius numérico exacto** para iOS 26 si no estás leyendo la plantilla oficial.
- No dibujes la máscara final “a ojo” si necesitas precisión real de entrega.

### 3.3 Instrucción correcta para una IA
Cuando generes el icono:
- usa una **máscara rounded-rectangle oficial de Apple** para iPhone/iPad/Mac;
- si la plantilla oficial no está cargada en el entorno, declara que el radio de esquina es **template-defined**;
- evita cualquier crop manual basado en estimaciones.

### 3.4 Regla crítica de exportación
- **Nunca exportes la máscara rounded rectangle o circular dentro del arte**.
- Apple indica que la máscara se aplica después de forma automática.

---

## 4) Cómo debe verse el icono en iPhone con iOS 26

### 4.1 Apariencia general
El icono debe verse:
- limpio;
- centrado;
- con respiro;
- más frontal que exageradamente 3D;
- compatible con brillo especular, translucencia y sombras por capa.

### 4.2 En la Home Screen
En iPhone el sistema lo presenta:
- dentro de una **máscara rounded rectangle** del sistema;
- con tratamiento de **Liquid Glass**;
- con reflejos y comportamiento óptico que refuerzan profundidad;
- con variantes para distintos modos visuales.

### 4.3 Modos visuales
Apple habla de estos modos/apariencias:
- **Default**
- **Dark**
- **Mono**
- además del comportamiento en opciones **tinted** y **clear/translucent** derivadas del mismo arte

La IA debe producir un diseño que siga siendo claro en todas esas presentaciones.

---

## 5) Reglas visuales duras para generar el arte

### 5.1 Composición
- Mantén el motivo principal **centrado**.
- Deja **breathing room**; no pegues el dibujo al borde útil del icono.
- La nueva retícula de Apple da más espacio a composiciones circulares y proporciones variadas.

### 5.2 Forma y detalle
- Evita **thin lines** y **sharp edges**.
- Prefiere **rounder corners** y pesos visuales más robustos.
- Usa detalles que sobrevivan a tamaños pequeños.
- No dependas de microdetalles para comunicar la idea.

### 5.3 Profundidad
- La profundidad debe surgir sobre todo de:
  - capas;
  - translucencia;
  - blur;
  - highlights;
  - sombras del sistema.
- Evita objetos hiperrealistas que compitan con la materialidad del vidrio.
- Apple favorece un enfoque más **flat + layered + frontal** que un render 3D pesado.

### 5.4 Fondo
- Usa un solo **background**.
- Apple recomienda gradientes suaves de claro a oscuro que armonicen con la dirección de la luz.
- Para fondos oscuros o claros, Apple menciona usar **System Light** y **System Dark gradients** en lugar de blanco o negro puros.
- Un fondo coloreado suele ayudar a diferenciar mejor entre modos.

### 5.5 Foreground
- Los elementos del primer plano deben tener **bordes claramente definidos** para que el sistema dibuje bien highlights y efectos ópticos.
- Al menos un elemento dominante debe mantener gran legibilidad cuando el icono se simplifique para **Mono**.
- En Mono, suele ayudar que una parte principal sea blanca o muy luminosa.

### 5.6 Transparencia
- No abuses de grandes zonas semitransparentes en el arte fuente.
- Apple advierte que opacidades reducidas pueden mezclarse visualmente con sombras y perder lectura.

---

## 6) Reglas técnicas de exportación

### 6.1 Vectores
- Si el arte es vectorial, exporta capas como **SVG**.
- Exporta cada capa al **tamaño completo del canvas** para que caiga en posición correcta dentro de Icon Composer.
- Numera los archivos según el **orden Z**.

### 6.2 Raster y elementos no SVG
- Si usas gradientes personalizados, raster, texturas o elementos que no se representen bien en SVG, exporta esas capas como **PNG**.
- Esos PNG sí pueden tener **fondo transparente** a nivel de capa.

### 6.3 Texto
- Si algún elemento textual forma parte indispensable del icono, conviértelo a **outlines** antes de exportar SVG.
- Aun así, evita depender del texto: en tamaños pequeños suele perderse.

### 6.4 Qué agregar en Icon Composer y no afuera
- Fondos sólidos y gradientes simples pueden agregarse directamente dentro de **Icon Composer**.
- Blur, specular, sombras y ajustes finos de vidrio deben resolverse en **Icon Composer**, no hornearse de forma destructiva en el arte base.

---

## 7) Lo que la IA NO debe hacer
- No hornear la máscara rounded rectangle dentro del PNG o SVG.
- No inventar un radio numérico de esquina “oficial”.
- No colocar detalles importantes demasiado cerca del borde.
- No usar hairlines.
- No usar esquinas filosas cuando puedan redondearse.
- No diseñar una ilustración tan compleja que el material de vidrio pierda protagonismo.
- No asumir que una sola apariencia basta: debe funcionar en **Default**, **Dark** y **Mono**.
- No usar blanco puro o negro puro como única solución de fondo si el resultado rompe el comportamiento del material.
- No meter demasiados grupos/capas sin necesidad.
- No exportar elementos fuera del canvas esperando que sobresalgan irregularmente.

---

## 8) Especificación operativa para otra IA

Copia y pega esto como instrucción maestra:

> Diseña un icono de app para Apple optimizado para iPhone en iOS 26 con lenguaje visual Liquid Glass. Usa un canvas maestro de 1024x1024 px. Estructura el icono con 1 capa de fondo y 1 o más capas de primer plano, con composición centrada y suficiente breathing room. El estilo debe ser simple, memorable, frontal y apto para highlights especulares, translucencia, blur y sombras por capa. Evita thin lines, sharp edges, microdetalles y cualquier forma que dependa de un radio de esquina inventado. No incluyas la máscara rounded rectangle en el arte exportado; esa máscara debe considerarse template-defined y aplicada por el sistema/plantilla oficial de Apple. Si produces capas vectoriales, expórtalas como SVG al tamaño completo del canvas; si produces raster, gradientes personalizados o elementos no SVG, usa PNG con transparencia por capa. Diseña el icono para que siga siendo legible en Default, Dark y Mono, y para que también tolere variantes tinted y clear. Prefiere fondos con gradientes suaves o color controlado, no fondos blancos o negros puros cuando perjudiquen el material. El resultado final debe sentirse nativo de Apple, con profundidad lograda por capas y material, no por un render 3D pesado.

---

## 9) Versión más estricta, tipo checklist

La IA debe verificar esto antes de dar por terminado el icono:

- [ ] Canvas maestro de 1024x1024 px
- [ ] Composición centrada
- [ ] Respira bien dentro de la retícula
- [ ] No se dibujó la máscara del icono dentro del arte
- [ ] No se inventó corner radius oficial
- [ ] Tiene fondo + foreground(s)
- [ ] No hay thin lines críticas
- [ ] No hay detalles esenciales pegados al borde
- [ ] Se ve bien en Default
- [ ] Se ve bien en Dark
- [ ] Se ve bien en Mono
- [ ] Puede tolerar tinted y clear
- [ ] Los efectos de profundidad dependen de capas/material, no de render pesado
- [ ] Los SVG/PNG están exportados a canvas completo
- [ ] Orden Z consistente

---

## 10) Qué sí se puede afirmar y qué no

### Sí se puede afirmar
- El canvas maestro es 1024x1024 px para iPhone/iPad/Mac.
- Apple Watch usa 1088x1088 px.
- Apple usa una retícula nueva con rounded rectangle más redondo.
- Apple recomienda templates/grids oficiales.
- Apple aplica máscara automáticamente.
- Icon Composer trabaja con capas, grupos, apariencias y propiedades Liquid Glass.
- El icono debe funcionar en Default, Dark y Mono, y convivir con modos clear/tinted.

### No se debe afirmar sin plantilla oficial cargada
- El valor exacto del radio de esquina en pixeles.
- Un margen interno exacto universal en pixeles.
- Una fórmula “oficial” de safe area del icono si no sale de la template oficial.

---

## 11) Fuentes oficiales base consultadas
- Apple Human Interface Guidelines: **App icons**
- Apple Developer: **Icon Composer**
- WWDC25: **Say hello to the new look of app icons**
- WWDC25: **Create icons with Icon Composer**
- Apple Developer Design Resources: **App Icon Template / Production Templates / UI Kits**
- Apple Developer Xcode documentation: **Creating your app icon using Icon Composer**
- Apple Asset Catalog reference para tamaños de iconos y variantes de salida
