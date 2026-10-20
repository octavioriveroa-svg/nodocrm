import SharedProjectDetailView from '@/components/proyectos/SharedProjectDetailView'

export default function FinderDetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectDetailView params={params} />
}
