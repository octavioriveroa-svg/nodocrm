import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default function EPCInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectInstalacionesView params={params} portal="epc" />
}
