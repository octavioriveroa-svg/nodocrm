import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nodo CRM",
  description: "Plataforma de gestión de proyectos de energía",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full" style={{ backgroundColor: '#F9F6EF', color: '#000000' }}>
        {children}
      </body>
    </html>
  );
}
