import SharedClientDetailView from '@/components/clientes/SharedClientDetailView'

export default function AnalistaClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedClientDetailView params={params} portalPrefix="analista" canDelete={false} />
}
