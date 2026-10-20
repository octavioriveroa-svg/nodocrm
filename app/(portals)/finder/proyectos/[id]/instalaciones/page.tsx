import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default function FinderInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectInstalacionesView params={params} portal="finder" />
}
