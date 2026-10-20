import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-fondo">
      <div className="glass-card max-w-md w-full p-8 text-center">
        <h1 className="text-3xl font-black text-principal mb-2">404</h1>
        <p className="text-sm text-muted mb-6">La página que buscas no existe o fue movida.</p>
        <Link
          href="/login"
          className="inline-block px-5 py-2.5 rounded-lg bg-acento text-principal font-bold text-sm"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
