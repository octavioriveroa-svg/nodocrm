import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default function AnalistaInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectInstalacionesView params={params} portal="analista" />
}
