import SharedProjectDetailView from '@/components/proyectos/SharedProjectDetailView'

export default function AnalistaDetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectDetailView params={params} />
}
