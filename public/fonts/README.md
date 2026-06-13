# Fuentes de marca — Nodo

La plataforma referencia dos fuentes **comerciales (de pago)** del brandbook. No se pueden
incluir en el repo sin licencia, así que **no están aquí**. Mientras falten, la app cae
automáticamente a **Inter** (que también es fuente de marca), sin romperse.

## Archivos esperados (coloca los `.woff2` aquí)

| Archivo | Fuente | Rol en la UI | Dónde conseguirla |
|---|---|---|---|
| `ArticulatCF-DemiBold.woff2` | **Articulat CF** DemiBold | Títulos (`font-heading`) | Connary Fagen (connary.com) — licencia web |
| `BCBarell-1973.woff2` | **BC Barell 1973** | Cifras/datos (`font-numeric`) | Briefcase Type Foundry (briefcasetype.com) — licencia web |

> El brandbook rotula los títulos como "Articulat CF **Bold**", pero la fuente realmente
> incrustada en el PDF es **DemiBold**. Usar DemiBold.

## Cómo activarlas

1. Compra la **licencia web** (webfont) de cada fuente, o pídele a SBM Design los `.woff2` con licencia.
2. Copia los archivos a esta carpeta con **exactamente** los nombres de la tabla.
3. Listo — `@font-face` en `app/globals.css` ya apunta a `/fonts/<archivo>.woff2`.
   No hace falta tocar código. Si el nombre difiere, ajusta el `src` en `globals.css`.

## Convertir a woff2 (si te dan .otf/.ttf con licencia)

```bash
# con fonttools instalado: pip install fonttools[woff]
fonttools ttLib.woff2 compress ArticulatCF-DemiBold.otf
```

Verifica siempre que tu licencia permita uso **@font-face / web**.
