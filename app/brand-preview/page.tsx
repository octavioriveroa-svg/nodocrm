import { notFound } from 'next/navigation'
import Logo from '@/components/Logo'
import StepIndicator from '@/components/ui/StepIndicator'
import StatFigure from '@/components/ui/StatFigure'

// Página interna de QA visual de marca (ruta pública, sin login).
// No es parte del producto; sirve para revisar componentes y tokens contra el brandbook.

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="w-full h-14 rounded-lg border border-borde" style={{ backgroundColor: `var(${varName})` }} />
      <span className="text-[11px] text-texto-suave">{name}</span>
      <code className="text-[10px] text-texto-suave">{varName}</code>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-texto-suave mb-5">{title}</h2>
      {children}
    </section>
  )
}

export default function BrandPreview() {
  // Ruta de QA solo para desarrollo — nunca expuesta en producción.
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <Logo size="lg" color="petrol" />
        <span className="text-xs text-texto-suave">QA de marca · /brand-preview</span>
      </header>

      {/* Logo sobre las combinaciones aprobadas (Brand/BRAND.md §2) */}
      <Card title="Logo · combinaciones aprobadas">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-8 grid place-items-center" style={{ backgroundColor: 'var(--color-principal)' }}>
            <Logo color="lima" />
          </div>
          <div className="rounded-xl p-8 grid place-items-center" style={{ backgroundColor: 'var(--color-menta)' }}>
            <Logo color="verde-claro" />
          </div>
          <div className="rounded-xl p-8 grid place-items-center" style={{ backgroundColor: 'var(--color-verde-claro)' }}>
            <Logo color="petrol" />
          </div>
          <div className="rounded-xl p-8 grid place-items-center" style={{ backgroundColor: 'var(--color-acento)' }}>
            <Logo color="petrol" />
          </div>
        </div>
      </Card>

      {/* Paleta */}
      <Card title="Paleta de marca">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <Swatch name="Petróleo" varName="--color-principal" />
          <Swatch name="Lima" varName="--color-acento" />
          <Swatch name="Menta" varName="--color-menta" />
          <Swatch name="Salvia" varName="--color-salvia" />
          <Swatch name="Verde claro" varName="--color-verde-claro" />
          <Swatch name="Arena" varName="--color-arena" />
        </div>
      </Card>

      {/* Indicador de pasos (pág. 28) */}
      <Card title="Indicador de pasos (pág. 28)">
        <StepIndicator steps={['Información básica', 'Sitios y productos', 'Financiamiento']} current={1} />
      </Card>

      {/* Cifras financieras (pág. 29) */}
      <Card title="Cifras financieras (pág. 29)">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <StatFigure label="Pago mensual actual" value="$1,256,765" tone="plain" />
          <StatFigure label="Nuevo pago mensual" value="$745,209" tone="menta" />
          <StatFigure label="Ahorro mensual" value="$520,000" tone="accent" />
          <StatFigure label="% de ahorro" value="40%" tone="accent" size="md" />
          <StatFigure label="Payback" value="3.2 años" tone="plain" size="md" />
          <StatFigure label="Capacidad" value="480 kWp" tone="menta" size="md" />
        </div>
      </Card>

      {/* Tipografía */}
      <Card title="Tipografía">
        <div className="flex flex-col gap-3">
          <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Conectar bien cambia todo.</p>
          <p className="text-base">Texto base en Inter — claridad, estructura y confianza sin ruido.</p>
          <p className="num text-2xl font-black">1234567890 · $1,256,765 · 40%</p>
          <p className="text-[11px] text-texto-suave">Títulos: Articulat CF (fallback Inter) · Cuerpo: Inter · Cifras: BC Barell 1973 (fallback Inter)</p>
        </div>
      </Card>

      {/* Botones */}
      <Card title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--color-acento)', color: 'var(--color-principal)' }}>Cotiza tu proyecto</button>
          <button className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-principal)' }}>Secundario</button>
          <button className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-borde bg-white">Outline</button>
        </div>
      </Card>
    </div>
  )
}
