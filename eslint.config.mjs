import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Marca de marca: prohíbe colores hex crudos en el código. Usa tokens
  // (clases bg-acento/text-principal… o var(--color-*)); define colores nuevos
  // en app/globals.css @theme. Ver Brand/BRAND.md §9. Severidad "warn": no rompe
  // el build, solo señala la deuda pendiente de migrar a tokens.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", {
        selector: "Literal[value=/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})/]",
        message: "Color hex crudo prohibido: usa un token de marca (clase bg-acento/text-principal/… o var(--color-*)). Colores nuevos van en app/globals.css @theme. Ver Brand/BRAND.md.",
      }],
    },
  },
]);

export default eslintConfig;
