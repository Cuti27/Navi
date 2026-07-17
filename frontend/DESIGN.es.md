---
name: Analogue Blueprint
lang: es
en: [English version](./DESIGN.md)
colors:
  surface: '#fff8f6'
  surface-dim: '#e8d6d2'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ed'
  surface-container: '#fceae5'
  surface-container-high: '#f6e4e0'
  surface-container-highest: '#f0dfda'
  on-surface: '#221a17'
  on-surface-variant: '#55433d'
  inverse-surface: '#382e2b'
  inverse-on-surface: '#ffede8'
  outline: '#88726c'
  outline-variant: '#dbc1b9'
  surface-tint: '#99462a'
  primary: '#99462a'
  on-primary: '#ffffff'
  primary-container: '#d97757'
  on-primary-container: '#541400'
  inverse-primary: '#ffb59e'
  secondary: '#545f72'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f7'
  on-secondary-container: '#586377'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#09a493'
  on-tertiary-container: '#00312b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#390b00'
  on-primary-fixed-variant: '#7a2f15'
  secondary-fixed: '#d8e3fa'
  secondary-fixed-dim: '#bcc7dd'
  on-secondary-fixed: '#111c2c'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#7df7e3'
  tertiary-fixed-dim: '#5edac7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#fff8f6'
  on-background: '#221a17'
  surface-variant: '#f0dfda'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-ui:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1200px
---

## Marca y Estilo

El sistema de diseño de este agente de IA para Homelab se inspira en la estética "Analogue Blueprint": una síntesis de la documentación técnica de mediados del siglo XX y la precisión de la ingeniería moderna. La personalidad de marca es autoritaria pero cercana, actuando como un copiloto confiable para la infraestructura técnica. Evita el blanco estéril típico de los SaaS a favor de una paleta cálida y táctil que evoca el papel de archivo y los planos arquitectónicos.

El estilo visual apuesta por el **Minimalismo** con un giro **Estructural**. Prioriza la densidad de información y la claridad técnica sin sacrificar la calidez. La alineación de alta precisión, el uso intencional de acentos monoespaciados y una estrategia de capas "papel sobre papel" crean un entorno profesional adecuado para gestionar entornos complejos de servidores domésticos.

## Colores

La paleta está diseñada para reducir la fatiga visual durante largas sesiones técnicas.

- **Fondo primario (#F6F5F1):** Una base cálida hueso/crema que proporciona una superficie suave y no reflectante.
- **Superficies (#FFFFFF):** El blanco puro se reserva estrictamente para tarjetas interactivas y superficies elevadas, creando un contraste nítido de "plano".
- **Texto primario (#2D3748):** Un gris carbón que mantiene alta legibilidad sin ser tan duro como el negro puro.
- **Acentos:** La terracota (#D97757) se usa para acciones primarias y estados "sistema activo", mientras que el azul pizarra (#4A5568) aporta un tono secundario estructural, de grado ingenieril, para bordes e iconografía.

## Tipografía

Este sistema de diseño utiliza un enfoque de doble tipografía para distinguir entre la guía conversacional de la IA y los datos técnicos del sistema.

- **Inter** es la tipografía principal para todos los elementos de interfaz, títulos y burbujas de chat, asegurando una sensación moderna y accesible.
- **JetBrains Mono** se emplea para metadatos técnicos, vistas previas de payloads, direcciones IP y etiquetas de estado. Esto distingue el lenguaje "Humano" de los datos "Máquina".

Los títulos deben usar un interletrado ajustado para mantener una apariencia profesional y arquitectónica. Los estilos de etiqueta deben usar frecuentemente mayúsculas con mayor interletrado para imitar los sellos de ingeniería.

## Layout y Espaciado

La filosofía de layout sigue una **Cuadrícula Fluida** con adherencia estricta a una ritmo base de 4px.

- **Estructura:** Una cuadrícula de 12 columnas para escritorio y 4 columnas para móvil.
- **Densidad:** La densidad de información debe ser moderada. Usa márgenes generosos (#xl) para separar secciones principales como "Interacción del Agente" y "Salud del Servidor", pero un padding ajustado (#sm) dentro de las tablas de datos técnicos.
- **Jerarquía:** El contenido fluye verticalmente en móvil, pero utiliza un layout de "Centro de Comando" en escritorio (breakpoint `md:` y superior). La columna izquierda muestra el avatar del agente Navi en un tamaño prominente (`md:w-1/2 md:max-w-[520px]`), mientras que la columna derecha contiene el contenido principal: la lista de sesiones en la pantalla de inicio o la conversación y el compositor en la pantalla de chat.

## Elevación y Profundidad

Para mantener la estética "Blueprint", la profundidad se transmite mediante **Capas Tonales** y **Contornos de Bajo Contraste** en lugar de sombras pesadas.

- **Bordes:** Todas las tarjetas principales y campos de entrada usan un borde sólido de 1px en azul pizarra al 15-20% de opacidad.
- **Sombras:** Solo se usa un nivel de sombra: una sombra técnica muy sutil y nítida (`0px 2px 4px rgba(0,0,0,0.05)`) para elevar la tarjeta de interacción activa o el modal sobre el fondo hueso.
- **Capas:** La capa base es Hueso (#F6F5F1). La segunda capa (Tarjetas/Burbujas) es Blanco Puro (#FFFFFF). La tercera capa (Activo/Focus) usa un borde de acento terracota.

## Formas

El lenguaje de formas es **Suave (0.25rem)**. Esto aporta suficiente redondez para sentirse moderno y amigable, manteniendo al mismo tiempo la integridad estructural y la precisión de una herramienta de ingeniería.

- **Botones e Inputs estándar:** radio de esquina de 0.25rem (4px).
- **Tarjetas y Burbujas de Chat:** radio de esquina de 0.5rem (8px).
- **Contenedor del Avatar:** Circular (999px) para contrastar con la cuadrícula rígida.

## Componentes

- **Botones:** Los botones primarios usan el fondo terracota (#D97757) con texto blanco. Los botones secundarios son estilo ghost con borde azul pizarra y etiquetas monoespaciadas.
- **Burbujas de Chat de la IA:** Las respuestas del agente usan la superficie blanca pura con un borde de 1px. Las entradas del usuario usan un tinte gris muy claro para distinguir el flujo.
- **Chips Técnicos:** Usados para el estado del servidor (p. ej., "Online", "CPU 12%"). Usan texto JetBrains Mono y un fondo tintado sutil que coincide con el color de estado (Éxito/Error).
- **Avatar SVG:** El icono del agente Navi debe ser un SVG geométrico basado en líneas. Las micro-interacciones deben incluir un sutil "pulso" en el grosor del trazo durante los estados de pensamiento de la IA.
- **Tarjetas de Datos:** Las tarjetas de información técnica (salud del disco duro, logs de red) deben tener un encabezado monoespaciado y una línea divisoria de 1px para separar secciones.
- **Inputs:** Los campos de texto deben usar un borde de 1px que cambia de gris claro a azul pizarra al hacer focus, sin efecto de "glow", manteniendo la sensación nítida de plano.
