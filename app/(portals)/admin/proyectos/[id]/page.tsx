import SharedProjectDetailView from '@/components/proyectos/SharedProjectDetailView'

export default function AdminDetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectDetailView params={params} />
}
