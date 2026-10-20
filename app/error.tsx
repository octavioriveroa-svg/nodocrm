'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-fondo">
      <div className="glass-card max-w-md w-full p-8 text-center">
        <h2 className="text-xl font-black text-principal mb-2">Ocurrió un problema inesperado</h2>
        <p className="text-sm text-muted mb-6">
          {error.message || 'No pudimos cargar esta sección. Por favor intenta nuevamente.'}
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-lg bg-acento text-principal font-bold text-sm hover:opacity-90 transition-all"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
