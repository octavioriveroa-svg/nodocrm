import SharedProjectDetailView from '@/components/proyectos/SharedProjectDetailView'

export default function EpcDetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectDetailView params={params} />
}
