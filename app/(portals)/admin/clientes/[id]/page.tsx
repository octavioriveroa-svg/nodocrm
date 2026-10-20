import SharedClientDetailView from '@/components/clientes/SharedClientDetailView'

export default function AdminClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedClientDetailView params={params} portalPrefix="admin" canDelete={true} />
}
