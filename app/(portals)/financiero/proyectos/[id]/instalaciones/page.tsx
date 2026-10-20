import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default function FinancieroInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectInstalacionesView params={params} portal="financiero" />
}
