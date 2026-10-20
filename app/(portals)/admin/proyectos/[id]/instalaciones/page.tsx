import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default function AdminInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectInstalacionesView params={params} portal="admin" />
}
