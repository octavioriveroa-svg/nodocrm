# Nodo — Fuente de Verdad de Marca (Brand Source of Truth)

> Documento maestro destilado del **Manual de Identidad de Nodo** (53 págs., SBM Design)
> y verificado técnicamente contra el PDF original (capa de texto + capa vectorial + fuentes incrustadas).
> Sirve como referencia única para alinear la plataforma `nodocrm` con la marca.
>
> **Última verificación:** 2026-06-11 · Archivo fuente: `Brand/Brandbook/Nodo_Brandbook_Final-compressed.pdf`

---

## 0. Cómo se verificó esto (nivel de confianza)

| Dato | Método | Confianza |
|---|---|---|
| HEX / Pantone / RGB / CMYK | Extraído de la **capa de texto** del PDF (literal) + corroborado contra los **rellenos vectoriales** de los swatches | **Alta** (no es percepción) |
| Nombres de tipografías | Lista de **fuentes incrustadas** en el PDF | **Alta** |
| Reglas de logo, voz, mensajes | Texto literal del manual | **Alta** |
| Estilo fotográfico, "vibra", composición | Lectura visual de las páginas renderizadas | Media (interpretación) |

> ⚠️ **Discrepancia detectada y resuelta:** el manual rotula la tipografía de títulos como *"Articulat CF Bold"*, pero la fuente **realmente incrustada** es `ArticulatCF-DemiBold`. Se usa **DemiBold** como peso canónico de títulos.
>
> ⚠️ Los swatches vectoriales de la pág. 25 difieren ±1–2 unidades de los HEX rotulados (p. ej. swatch `#072A31` vs HEX rotulado `#072B31`). **Los valores canónicos son los HEX rotulados por el diseñador** (abajo); las diferencias son redondeo de render. La pág. 26 (CMYK) se ve distinta a propósito: es la simulación de impresión, **no se usa para pantalla**.

---

## 1. Qué es Nodo

**Nodo** (marca completa: **Nodo Energy Consulting**) ayuda a **empresas instaladoras** de energía solar y baterías a **ofrecer financiamiento a sus clientes**, conectando **conocimiento + financiamiento + ejecución** en un solo proceso confiable.

- **Concepto creativo:** *Connected Flow* — "conectar bien para que todo lo demás simplemente funcione".
- **Propósito:** hacer los proyectos de energía más claros, accesibles y posibles.
- **Público:** (1) empresas instaladoras/EPC; (2) empresas finales que buscan soluciones energéticas.
- **Valores:** **Claridad · Confianza · Conexión · Estructura.**
- **Personalidad:** Clara, Segura, Estratégica, Conectada, Moderna, Confiable. *"No busca llamar la atención con ruido; su fuerza está en la claridad, la estructura y la confianza."*

> 🧭 **Implicación de producto:** la UI debe sentirse **clara, estructurada y silenciosa** — sin ruido visual gratuito. Jerarquía nítida, mucho aire, color usado con intención (no decoración).

---

## 2. Paleta de color (CANÓNICA — para pantalla / RGB)

Estos son los valores **digitales** (pág. 25 del manual). Para impresión, usar CMYK (pág. 26), nunca en pantalla.

| Rol de marca | Nombre | HEX | RGB | Pantone | CMYK |
|---|---|---|---|---|---|
| **Base oscura / tinta** | Petróleo | `#072B31` | 7, 43, 49 | 546 C | 97, 32, 34, 86 |
| **Acento primario** | Lima | `#CEDC00` | 206, 220, 0 | 381 C | 18, 0, 99, 0 |
| **Acento secundario** | Menta / Teal | `#00C19F` | 0, 193, 159 | 2240 C | 82, 0, 56, 0 |
| Neutro medio | Salvia | `#9AB9AD` | 154, 185, 173 | 623 C | 40, 10, 27, 1 |
| Neutro claro | Verde claro | `#D1E0D7` | 209, 224, 215 | 621 C | 13, 0, 9, 0 |
| Neutro cálido | Arena | `#D6D9C7` | 214, 217, 199 | 6197 C | 12, 5, 15, 0 |

**Jerarquía de uso (deducida de las aplicaciones del manual):**

- **Petróleo `#072B31`** = color "negro" de la marca. **La marca NO usa negro puro.** Es el fondo oscuro estrella (sidebars, secciones dark, botones secundarios) y el color de texto principal sobre claro.
- **Lima `#CEDC00`** = acento de acción/energía. Estados activos, CTAs destacados, números/datos clave, highlights. Úsese con moderación (es muy saturado).
- **Menta `#00C19F`** = acento de apoyo. Iconografía de "nodo", gráficas, avatares, badges secundarios, detalles. Más versátil que la lima para áreas grandes.
- **Salvia / Verde claro / Arena** = fondos sutiles, superficies neutras, bordes, estados deshabilitados.

**Combinaciones logo/fondo aprobadas (págs. 33–38):**

| Fondo | Color del logo |
|---|---|
| Petróleo `#072B31` | Menta `#00C19F` · Lima `#CEDC00` · Verde claro `#D1E0D7` |
| Lima `#CEDC00` | Petróleo `#072B31` |
| Menta `#00C19F` | Petróleo `#072B31` |
| Salvia / Arena | Petróleo `#072B31` |
| Blanco | Petróleo `#072B31` |

> ⚠️ **Contraste/accesibilidad:** la **lima sobre blanco** y la **lima como texto** tienen contraste pobre (es casi amarillo). Usar lima para **superficies/acentos**, no para texto pequeño. Para texto sobre lima, usar **petróleo**.

---

## 3. Tipografía

| Rol | Familia | Peso | Caso | Tracking máx | Licencia |
|---|---|---|---|---|---|
| **Títulos primarios** | **Articulat CF** | **DemiBold** (rotulado "Bold" en el manual) | Mayús/minús | 10 pts | 🔒 **Comercial** (de pago) |
| Títulos secundarios | **Inter** | Medium | MAYÚSCULAS | 100 pts | ✅ Libre (Google/OFL) |
| Texto base | **Inter** | Regular | Mayús/minús | 10 pts | ✅ Libre |
| Detalles y números | **BC Barell 1973** | — | MAYÚSCULAS | 25 pts | 🔒 **Comercial** (de pago) |

> 🔒 **Bloqueante de licencia:** `Articulat CF` (Connary Fagen) y `BC Barell 1973` (Briefcase Type Foundry) son fuentes **de pago**. No se pueden descargar libremente ni incluir en el repo sin licencia. Hay que **comprarlas y auto-hospedarlas** en `/public/fonts/`. Mientras tanto, la plataforma usa **Inter** como fallback (Inter ya es una fuente de marca, así que el fallback es coherente).
>
> Recomendación: pedir a SBM Design los archivos `.woff2` con licencia web, o comprar la licencia web. Ver `/public/fonts/README.md`.

**Notas:** El propio PDF del manual está maquetado con **DM Sans** (también incrustada), pero **DM Sans NO es una fuente de marca** — es la fuente del documento. No usarla en producto.

---

## 4. Logotipo

- **Tipo:** logotipo tipográfico (wordmark) "**nodo**" en **minúsculas**, basado en Articulat CF, con símbolo **®**.
- **Concepto:** las dos "**o**" son **nodos** (puntos de conexión).
- **Variante con descriptor:** `nodo` + `ENERGY CONSULTING` (en Inter, a la derecha) cuando se necesita explicar la marca.
- **Margen de seguridad:** `X = el counter (hueco interior) de la "o"`. Reservar al menos `X` de espacio libre alrededor del logo en los 4 lados.
- **Tamaño mínimo:** Digital **140 × 45 px** · Impreso **210 × 67 px**.

**Usos incorrectos (prohibido):** rotar/voltear · estirar · encoger · usar colores fuera de paleta · ponerlo sobre fondos que afecten legibilidad · usarlo solo en delineado/contorno · añadir sombras/efectos.

> 📦 **Estado en la plataforma:** `components/Logo.tsx` usa `public/nodo-black.png` / `nodo-white.png` (raster).
> **Recomendaciones:** (1) verificar que el logo claro use **petróleo `#072B31`**, no negro puro; (2) migrar a **SVG** para nitidez en cualquier tamaño; (3) obtener el SVG oficial de SBM Design (no recrear el mark a mano — riesgo de deformar las letras).

---

## 5. Iconografía

- Iconos basados en el motivo de **nodo/red**: **puntos conectados por líneas** (visible en la web del manual, pág. 47), normalmente en **menta**.
- Estilo: lineal, simple, geométrico, mismo grosor de trazo. Coherente con la librería `lucide-react` ya usada en la plataforma (mantener trazo fino y consistente).

---

## 6. Tono de voz y mensajes

**Principios:** frases cortas, directas, sin tecnicismos. Calma y seguridad. Siempre alrededor de la idea de *conexión*.

**Eslóganes / titulares aprobados:**
- **"Conectar bien cambia todo."** (principal)
- "Todo conectado. Todo claro."
- "Donde todo se conecta."
- "Todo empieza con una conexión."
- "Menos complicaciones. Más claridad."
- "Planea el proyecto. Nosotros conectamos el resto."
- "Conectamos tu proyecto desde el inicio."

---

## 7. Estilo de fotografía

Transmite **claridad, tranquilidad y transformación**. Energía mostrada de forma **humana y sofisticada**: luz natural, reflejos, materiales limpios, arquitectura simple, paneles solares, infraestructura, composiciones orgánicas y sencillas. Paleta fría/neutra que combina con el petróleo y la menta.

---

## 8. La experiencia diseñada para la plataforma (págs. 28–29, 47–52)

El manual **ya muestra el CRM/dashboard de Nodo** (pág. 49). Patrones canónicos a respetar:

1. **Shell de app:** **sidebar petróleo oscuro** (logo claro arriba, nav con item activo en **lima**, avatar con acento) + **área de contenido clara** (casi blanca). ← La plataforma ya tiene esta estructura.
2. **Tarjetas KPI:** superficie clara, número grande, etiqueta pequeña en mayúsculas, **chip de icono** en lima o menta.
3. **Indicador de pasos (pág. 28):** círculos numerados conectados por una línea; el paso **activo relleno en lima**, los inactivos en contorno. Etiqueta debajo (Articulat) + copy de apoyo (Inter). → Patrón ideal para el flujo del proyecto (Soluciones → Alternativas → Resultados / fases EPC).
4. **Cifras financieras (pág. 29):** número **muy grande** en `BC Barell 1973`, etiqueta pequeña encima; marcadores de timeline con punto (el total/destacado en lima). → Para montos, ahorros, porcentajes.
5. **Gráficas (pág. 49):** barras en **menta + lima + petróleo** sobre fondo claro. Sin gradientes ruidosos.
6. **Botón CTA primario:** fondo lima, texto petróleo ("Cotiza tu proyecto hoy"). Secundario/oscuro: fondo petróleo, texto claro o lima.

> 🧭 **Decisión de estilo pendiente (flat vs glass):** la plataforma actual usa *glassmorphism* (blur, translucidez, mesh cálido). El mockup de marca (pág. 49) usa **superficies sólidas y planas**. El manual dice explícitamente "sin ruido". **Recomendación:** migrar hacia superficies más planas/sólidas como el mockup. Decisión del equipo.

---

## 9. Mapa marca → tokens de código (`globals.css` / `tailwind.config.ts`)

> En Tailwind v4 el bloque `@theme` de `app/globals.css` es la **fuente canónica** de tokens (genera las utilidades `bg-*`, `text-*`, …). `tailwind.config.ts` se mantiene en sync para evitar confusión.

| Token | Antes (fuera de marca) | Ahora (marca) | Notas |
|---|---|---|---|
| `--color-principal` | `#0F0F0F` (negro) | **`#072B31`** (petróleo) | Texto principal, superficies oscuras |
| `--color-acento` | `#D7FF2F` (lima neón) | **`#CEDC00`** (lima marca) | Estados activos, CTAs, datos clave |
| `--color-acento-hover` | `#c4ec23` | **`#B9C600`** | Lima un paso más oscuro |
| `--color-fondo` | `#F9F6EF` (crema cálido) | **`#F4F7F6`** (neutro frío claro) | Fondo de app más limpio/brand |
| `--color-borde` | `rgba(200,200,200,.25)` | **`rgba(7,43,49,.12)`** | Borde con tinte petróleo |
| `--color-muted` | `#888888` | **`#5F7A77`** | Gris con tinte petróleo |
| `--color-menta` | *(no existía)* | **`#00C19F`** | NUEVO — acento secundario |
| `--color-menta-hover` | — | **`#00A98B`** | NUEVO |
| `--color-salvia` | — | **`#9AB9AD`** | NUEVO — neutro |
| `--color-verde-claro` | — | **`#D1E0D7`** | NUEVO — neutro |
| `--color-arena` | — | **`#D6D9C7`** | NUEVO — neutro |
| `--font-heading` | — | `'Articulat CF', 'Inter', …` | Títulos (fallback Inter hasta licenciar) |
| `--font-sans` | Inter | `'Inter', …` | Cuerpo (ya correcto) |
| `--font-numeric` | — | `'BC Barell 1973', 'Inter', …` | Cifras (fallback Inter + tabular-nums) |

**Por qué este enfoque funciona:** los tokens `acento/principal/fondo/borde` se usan **~1 125 veces en 78 archivos**. Redefinir su *valor* (no su nombre) re-viste toda la app de una vez, sin tocar esos 78 archivos. Es quirúrgico y reversible.

---

## 10. Pendientes / deuda de alineación

- [ ] 🔒 Licenciar y auto-hospedar **Articulat CF DemiBold** y **BC Barell 1973** (`/public/fonts/`).
- [ ] Logo en **SVG** y color **petróleo** (no negro) para fondo claro; obtener vector oficial.
- [ ] Migrar colores **hardcodeados** a tokens (ej. `bg-[#1a1a1a]` en `Button`, colores de `recharts` en `EnergyChart`/`DashboardAnalytics`).
- [ ] Aplicar `--font-heading` a títulos y `--font-numeric` a cifras/montos en la UI.
- [ ] Decidir **flat vs glass** (sección 8) y, si flat, retirar/atenuar glassmorphism.
- [ ] Alinear colores semánticos (success → menta, etc.) si se desea coherencia total.
- [ ] Componentes patrón: **step indicator** (fases EPC) y **cifras financieras** según págs. 28–29.

---

*Generado a partir del brandbook oficial. Ante cualquier conflicto, el PDF del manual y los archivos oficiales de SBM Design prevalecen sobre este resumen.*
