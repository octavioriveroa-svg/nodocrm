import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a esta carpeta. Sin esto, Turbopack camina hacia
  // arriba y encuentra un package.json perdido en C:\Users\vmont (puppeteer),
  // infiriendo mal la raíz y rompiendo la resolución de `@import "tailwindcss"`.
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost']
};

export default nextConfig;
